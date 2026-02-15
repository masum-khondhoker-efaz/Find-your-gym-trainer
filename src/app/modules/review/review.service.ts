import prisma from '../../utils/prisma';
import { OrderStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  calculatePagination,
  formatPaginationResponse,
  getPaginationQuery,
} from '../../utils/pagination';
import {
  buildSearchQuery,
  buildFilterQuery,
  combineQueries,
  buildDateRangeQuery,
} from '../../utils/searchFilter';

const createReviewIntoDb = async (userId: string, data: any) => {

  // check the existing product
  const findProduct = await prisma.product.findUnique({
    where: {
      id: data.productId,
      isVisible: true,
    },
  });
  if (!findProduct) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const findExistingReview = await prisma.review.findFirst({
    where: {
      userId: userId,
      productId: data.productId,
    },
  });
  if (findExistingReview) {
    throw new AppError(
      httpStatus.CONFLICT,
      'You have already reviewed this course',
    );
  }

  // Check if user has completed the course
  const checkForOrder = await prisma.orderItem.findFirst({
    where: {
      productId: data.productId,
      order: {
        userId: userId,
        status: OrderStatus.DELIVERED,
      },
    },
  });

  if (!checkForOrder) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only review products you have purchased');
  }

  // Create review
  const result = await prisma.review.create({
    data: {
      userId: userId,
      productId: data.productId,
      rating: data.rating,
      comment: data.comment,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Review not created');
  }

  // Update course's average rating and total ratings
  const courseReviews = await prisma.review.findMany({
    where: {
      productId: data.productId,
    },
    select: {
      rating: true,
    },
  });

  const totalRatings = courseReviews.length;
  const averageRating =
    courseReviews.reduce((sum, review) => sum + review.rating, 0) /
    totalRatings;

  await prisma.product.update({
    where: {
      id: data.productId,
    },
    data: {
      avgRating: parseFloat(averageRating.toFixed(2)),
      totalRating: totalRatings,
    },
  });

  return result;
};

const getReviewListForACourseFromDb = async (
  productId: string,
  options: ISearchAndFilterOptions = {},
) => {
  // Pagination
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query (search in comment and user name)
  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            comment: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
          {
            user: {
              fullName: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
        ],
      }
    : {};

  // Build filter query
  const parsedRating = options.rating != null ? Number(options.rating) : undefined;

  const filterFields: Record<string, any> = {
    productId,
    ...(parsedRating !== undefined && !Number.isNaN(parsedRating)
      ? { rating: parsedRating }
      : {}),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Date range filtering
  const dateQuery = buildDateRangeQuery({
    startDate: options.startDate,
    endDate: options.endDate,
    dateField: 'createdAt',
  });

  // Combine all queries
  const whereQuery = combineQueries(searchQuery, filterQuery, dateQuery);

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.review.count({ where: whereQuery });

  // Fetch paginated reviews
  const reviews = await prisma.review.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      userId: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: {
        select: {
          fullName: true,
          email: true,
          image: true,
        },
      },
    },
  });

  // Calculate stats for all reviews of this product (not just current page)
  const allProductReviews = await prisma.review.findMany({
    where: { productId: productId },
    select: { rating: true },
  });

  const totalRatings = allProductReviews.length;
  const averageRating =
    totalRatings > 0
      ? allProductReviews.reduce((sum, review) => sum + review.rating, 0) /
        totalRatings
      : 0;

  // Return paginated response with stats
  const paginationResult = formatPaginationResponse(reviews, total, page, limit);

  return {
    ...paginationResult,
    stats: {
      totalRatings,
      averageRating: parseFloat(averageRating.toFixed(2)),
    },
  };
};



const getMyReviewsForSellerFromDb = async (
  sellerId: string,
  options: ISearchAndFilterOptions = {},
) => {
  // Pagination
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Product-level filters (productName or productId)
  const productFilter: any = {
    isVisible: true,
    sellerId: sellerId,
    ...(options.productId && { id: options.productId }),
    ...(options.productName && {
      productName: {
        contains: options.productName,
        mode: 'insensitive' as const,
      },
    }),
  };

  // Review-level filters
  const reviewWhere: any = {
    ...(options.rating && { rating: options.rating }),
    ...(options.searchTerm && {
      OR: [
        {
          comment: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          },
        },
        {
          user: {
            fullName: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        },
      ],
    }),
  };

  // Date filter applied to reviews
  if (options.startDate || options.endDate) {
    reviewWhere.createdAt = {};
    if (options.startDate)
      reviewWhere.createdAt.gte = new Date(options.startDate);
    if (options.endDate) reviewWhere.createdAt.lte = new Date(options.endDate);
  }

  // Fetch products with nested reviews matching reviewWhere
  const productsWithReviews = await prisma.product.findMany({
    where: productFilter,
    select: {
      id: true,
      productName: true,
      price: true,
      discount: true,
      productImages: true,
      review: {
        where: reviewWhere,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  // Flatten reviews across products
  const allReviews = productsWithReviews.flatMap(prod =>
    (prod.review || []).map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      customerName: r.user?.fullName,
      customerEmail: r.user?.email,
      customerImage: r.user?.image,
      productId: prod.id,
      productName: prod.productName,
      price: prod.price,
      discount: prod.discount,
      productImages: prod.productImages,
    })),
  );

  // Sort globally based on sortBy (default createdAt desc)
  const sorted = allReviews.sort((a: any, b: any) => {
    const field = sortBy || 'createdAt';
    const dir = (sortOrder || 'desc') === 'asc' ? 1 : -1;
    const av = a[field];
    const bv = b[field];
    if (!av && !bv) return 0;
    if (!av) return 1 * dir;
    if (!bv) return -1 * dir;
    return av > bv ? 1 * dir : av < bv ? -1 * dir : 0;
  });

  const total = sorted.length;

  // Paginate in-memory
  const paged = sorted.slice(skip, skip + limit);

  return formatPaginationResponse(paged, total, page, limit);
};

const getReviewByIdFromDb = async (userId: string, reviewId: string) => {
  const result = await prisma.review.findUnique({
    where: {
      id: reviewId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'review not found');
  }
  return result;
};

const updateReviewIntoDb = async (
  userId: string,
  reviewId: string,
  data: {
    rating: number;
    comment?: string;
  },
) => {
  const existingReview = await prisma.review.findUnique({
    where: {
      id: reviewId,
    },
  });
  if (!existingReview) {
    throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  }
  if (existingReview.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only update your own reviews',
    );
  }

  const result = await prisma.review.update({
    where: {
      id: reviewId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Review not updated');
  }
  return result;
};

const deleteReviewItemFromDb = async (userId: string, reviewId: string) => {
  const existingReview = await prisma.review.findUnique({
    where: {
      id: reviewId,
      userId: userId,
    },
  });
  if (!existingReview) {
    throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  }
  if (existingReview.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only delete your own reviews',
    );
  }

  const deletedItem = await prisma.review.delete({
    where: {
      id: reviewId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Review not deleted');
  }
  return deletedItem;
};

export const reviewService = {
  createReviewIntoDb,
  getReviewListForACourseFromDb,
  getMyReviewsForSellerFromDb,
  getReviewByIdFromDb,
  updateReviewIntoDb,
  deleteReviewItemFromDb,
};

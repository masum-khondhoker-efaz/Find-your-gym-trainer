import prisma from '../../utils/prisma';
import { OrderStatus, PaymentStatus, UserRoleEnum, ReviewType } from '@prisma/client';
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

// ==================== PRODUCT REVIEWS ====================
// Product reviews automatically review the trainer who created the product

const createProductReviewIntoDb = async (userId: string, data: any) => {
  const { productId, rating, comment } = data;

  // 1️⃣ Check if product exists and is visible
  const product = await prisma.product.findUnique({
    where: { id: productId, isActive: true },
    include: {
      user: {
        include: {
          trainers: true,
        },
      },
    },
  });
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  // 2️⃣ Check if user already reviewed this product
  const existingReview = await prisma.review.findFirst({
    where: { userId, productId, type: ReviewType.PRODUCT },
  });
  if (existingReview) {
    throw new AppError(
      httpStatus.CONFLICT,
      'You have already reviewed this product',
    );
  }

  // 3️⃣ Verify user purchased the product
  const purchasedOrder = await prisma.order.findFirst({
    where: {
      userId,
      productId,
      paymentStatus: PaymentStatus.COMPLETED,
      status: OrderStatus.COMPLETED,
    },
  });
  if (!purchasedOrder) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only review products you have purchased',
    );
  }

  // 4️⃣ Create review
  const review = await prisma.review.create({
    data: { userId, productId, rating, comment, type: ReviewType.PRODUCT },
  });
  if (!review) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Review not created');
  }

  // 5️⃣ Update product's average rating and total ratings
  const productReviews = await prisma.review.aggregate({
    where: { productId, type: ReviewType.PRODUCT },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      avgRating: parseFloat((productReviews._avg?.rating ?? 0).toFixed(2)),
      ratingCount: productReviews._count.rating,
    },
  });

  // 6️⃣ Update trainer's average rating (since this product review is also a trainer review)
  const trainerId = product.userId;
  const trainer = await prisma.trainer.findUnique({
    where: { userId: trainerId },
  });

  if (trainer) {
    // Get all reviews for all products by this trainer
    const trainerProducts = await prisma.product.findMany({
      where: { userId: trainerId },
      select: { id: true },
    });

    const trainerProductIds = trainerProducts.map(p => p.id);

    const trainerReviews = await prisma.review.aggregate({
      where: {
        productId: { in: trainerProductIds },
        type: ReviewType.PRODUCT,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.trainer.update({
      where: { userId: trainerId },
      data: {
        avgRating: parseFloat((trainerReviews._avg?.rating ?? 0).toFixed(2)),
        ratingCount: trainerReviews._count.rating,
      },
    });
  }

  return review;
};

const getProductReviewListFromDb = async (
  productId: string,
  options: ISearchAndFilterOptions = {},
) => {
  // Normalize sortOrder to ensure it's 'asc' or 'desc'
  const normalizedOptions = {
    ...options,
    sortBy: options.sortBy || 'createdAt',
    sortOrder: (options.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  };

  // Pagination
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(normalizedOptions);

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
  const parsedRating =
    options.rating != null ? Number(options.rating) : undefined;

  const filterFields: Record<string, any> = {
    productId,
    type: ReviewType.PRODUCT,
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

  // Fetch total count for pagination
  const total = await prisma.review.count({ where: whereQuery });

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch paginated reviews
  const reviews = await prisma.review.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      user: true,
      product: {
        include: {
          user: {
            select: {
              fullName: true,
              image: true,
            },
          },
        },
      },
      trainerReplies: {
        include: {
          trainer: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });
  if (reviews.length === 0) {
    // If no reviews found, still return pagination info with empty data
    return formatPaginationResponse([], total, page, limit);
  }

  // Flatten the response
  const flattenedReviews = reviews
    .filter(review => review.product !== null)
    .map(review => ({
      id: review.id,
      userId: review.userId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      userName: review.user.fullName,
      userEmail: review.user.email,
      userImage: review.user.image,
      productId: review.product!.id,
      productName: review.product!.productName,
      productImage: review.product!.productImage,
      trainerId: review.product!.userId,
      trainerName: review.product!.user.fullName,
      repliesCount: review.trainerReplies.length,
      reply: review.trainerReplies[0] ? {
        id: review.trainerReplies[0].id,
        reply: review.trainerReplies[0].reply,
        createdAt: review.trainerReplies[0].createdAt,
        trainerName: review.trainerReplies[0].trainer.user.fullName,
        trainerImage: review.trainerReplies[0].trainer.user.image,
      } : null,
    }));

  // Calculate stats for all reviews of this product
  const allProductReviews = await prisma.review.findMany({
    where: { productId: productId, type: ReviewType.PRODUCT },
    select: { rating: true },
  });

  const totalRatings = allProductReviews.length;
  const averageRating =
    totalRatings > 0
      ? allProductReviews.reduce((sum, review) => sum + review.rating, 0) /
        totalRatings
      : 0;

  // Return paginated response with stats
  const paginationResult = formatPaginationResponse(
    flattenedReviews,
    total,
    page,
    limit,
  );

  return {
    ...paginationResult,
    stats: {
      totalRatings,
      averageRating: parseFloat(averageRating.toFixed(2)),
    },
  };
};

const getTrainerReviewListFromDb = async (
  trainerId: string,
  options: ISearchAndFilterOptions = {},
) => {
  // 1️⃣ Get all products by this trainer
  const trainerProducts = await prisma.product.findMany({
    where: { userId: trainerId },
    select: { id: true },
  });
  const trainerProductIds = trainerProducts.map(p => p.id);

  // Normalize sortOrder to ensure it's 'asc' or 'desc'
  const normalizedOptions = {
    ...options,
    sortBy: options.sortBy || 'createdAt',
    sortOrder: (options.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  };

  // Pagination
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(normalizedOptions);
  
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
  const parsedRating =
    options.rating != null ? Number(options.rating) : undefined;
    
  const filterFields: Record<string, any> = {
    productId: { in: trainerProductIds },
    type: ReviewType.PRODUCT,
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
  // Fetch total count for pagination
  const total = await prisma.review.count({ where: whereQuery });
  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;
  // Fetch paginated reviews
  const reviews = await prisma.review.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      user: true,
      product: {
        include: {
          user: {
            select: {
              fullName: true,
              image: true,
            },
          },
        },
      },
      trainerReplies: {
        include: {
          trainer: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (reviews.length === 0) {
    // If no reviews found, still return pagination info with empty data
    return formatPaginationResponse([], total, page, limit);
  }

  // Flatten the response
  const flattenedReviews = reviews
    .filter(review => review.product !== null)
    .map(review => ({
      id: review.id,
      userId: review.userId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      userName: review.user.fullName,
      userEmail: review.user.email,
      userImage: review.user.image,
      productId: review.product!.id,
      productName: review.product!.productName,
      productImage: review.product!.productImage,
      trainerId: review.product!.userId,
      trainerName: review.product!.user.fullName,
      repliesCount: review.trainerReplies.length,
      reply: review.trainerReplies[0] ? {
        id: review.trainerReplies[0].id,
        reply: review.trainerReplies[0].reply,
        createdAt: review.trainerReplies[0].createdAt,
        trainerName: review.trainerReplies[0].trainer.user.fullName,
        trainerImage: review.trainerReplies[0].trainer.user.image,
      } : null,
    }));

  // Calculate stats for all reviews of this trainer
  const allTrainerReviews = await prisma.review.findMany({
    where: { 
      productId: { in: trainerProductIds }, 
      type: ReviewType.PRODUCT 
    },
    select: { rating: true },
  });

  const totalRatings = allTrainerReviews.length;
  const averageRating =
    totalRatings > 0
      ? allTrainerReviews.reduce((sum, review) => sum + review.rating, 0) /
        totalRatings
      : 0;

  // Return paginated response with stats
  const paginationResult = formatPaginationResponse(
    flattenedReviews,
    total,
    page,
    limit,
  );

  return {
    ...paginationResult,
    stats: {
      totalRatings,
      averageRating: parseFloat(averageRating.toFixed(2)),
    },
  };
};

// ==================== SYSTEM REVIEWS ====================

const createSystemReviewIntoDb = async (userId: string, data: any) => {
  const { rating, comment } = data;

  // 1️⃣ Check if user already submitted a system review
  const existingReview = await prisma.review.findFirst({
    where: { userId, type: ReviewType.SYSTEM },
  });
  if (existingReview) {
    throw new AppError(
      httpStatus.CONFLICT,
      'You have already reviewed the system',
    );
  }

  // 2️⃣ Verify user has made at least one purchase
  const hasPurchased = await prisma.order.findFirst({
    where: {
      userId,
      paymentStatus: PaymentStatus.COMPLETED,
      status: OrderStatus.COMPLETED,
    },
  });
  if (!hasPurchased) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only review the system after completing a purchase',
    );
  }

  // 3️⃣ Create review
  const review = await prisma.review.create({
    data: { userId, rating, comment, type: ReviewType.SYSTEM },
  });
  if (!review) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Review not created');
  }

  return review;
};

const getSystemReviewListFromDb = async (
  options: ISearchAndFilterOptions = {},
) => {
  // Normalize sortOrder to ensure it's 'asc' or 'desc'
  const normalizedOptions = {
    ...options,
    sortBy: options.sortBy || 'createdAt',
    sortOrder: (options.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  };

  // Pagination
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(normalizedOptions);

  // Build search query
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
  const parsedRating =
    options.rating != null ? Number(options.rating) : undefined;

  const filterFields: Record<string, any> = {
    type: ReviewType.SYSTEM,
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

  // Fetch total count for pagination
  const total = await prisma.review.count({ where: whereQuery });

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

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

  // Calculate stats for all system reviews
  const allSystemReviews = await prisma.review.findMany({
    where: { type: ReviewType.SYSTEM },
    select: { rating: true },
  });

  const totalRatings = allSystemReviews.length;
  const averageRating =
    totalRatings > 0
      ? allSystemReviews.reduce((sum, review) => sum + review.rating, 0) /
        totalRatings
      : 0;

  // Return paginated response with stats
  const paginationResult = formatPaginationResponse(
    reviews,
    total,
    page,
    limit,
  );

  return {
    ...paginationResult,
    stats: {
      totalRatings,
      averageRating: parseFloat(averageRating.toFixed(2)),
    },
  };
};

// ==================== TRAINER REPLIES ====================

const createTrainerReplyIntoDb = async (
  trainerId: string,
  reviewId: string,
  data: any,
) => {
  const { reply } = data;

  // 1️⃣ Check if review exists
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      product: {
        select: {
          userId: true,
        },
      },
    },
  });
  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  }

  // 2️⃣ Verify trainer can reply to this review (only product reviews)
  if (review.type !== ReviewType.PRODUCT) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only reply to product reviews',
    );
  }

  if (review.product?.userId !== trainerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only reply to reviews for your products',
    );
  }

  // 3️⃣ Check if trainer already replied
  const existingReply = await prisma.trainerReply.findFirst({
    where: { reviewId, trainerId },
  });
  if (existingReply) {
    throw new AppError(
      httpStatus.CONFLICT,
      'You have already replied to this review',
    );
  }

  // 4️⃣ Create reply
  const trainerReply = await prisma.trainerReply.create({
    data: { reviewId, trainerId, reply },
    include: {
      trainer: {
        select: {
          user: {
            select: {
              fullName: true,
              image: true,
            },
          },
        },
      },
    },
  });

  return trainerReply;
};

// ==================== COMMON REVIEW OPERATIONS ====================

const updateReviewIntoDb = async (
  userId: string,
  reviewId: string,
  data: {
    rating?: number;
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

  // Update aggregated ratings based on review type
  if (result.productId && result.type === ReviewType.PRODUCT) {
    // Update product rating
    const productReviews = await prisma.review.aggregate({
      where: { productId: result.productId, type: ReviewType.PRODUCT },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const product = await prisma.product.update({
      where: { id: result.productId },
      data: {
        avgRating: parseFloat((productReviews._avg?.rating ?? 0).toFixed(2)),
        ratingCount: productReviews._count.rating,
      },
    });

    // Update trainer rating (since product review is also trainer review)
    const trainerProducts = await prisma.product.findMany({
      where: { userId: product.userId },
      select: { id: true },
    });

    const trainerProductIds = trainerProducts.map(p => p.id);

    const trainerReviews = await prisma.review.aggregate({
      where: {
        productId: { in: trainerProductIds },
        type: ReviewType.PRODUCT,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.trainer.update({
      where: { userId: product.userId },
      data: {
        avgRating: parseFloat((trainerReviews._avg?.rating ?? 0).toFixed(2)),
        ratingCount: trainerReviews._count.rating,
      },
    });
  }

  return result;
};

const deleteReviewItemFromDb = async (userId: string, reviewId: string) => {
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
      'You can only delete your own reviews',
    );
  }

  const deletedItem = await prisma.review.delete({
    where: {
      id: reviewId,
    },
  });

  // Update aggregated ratings based on review type
  if (deletedItem.productId && deletedItem.type === ReviewType.PRODUCT) {
    // Update product rating
    const productReviews = await prisma.review.aggregate({
      where: { productId: deletedItem.productId, type: ReviewType.PRODUCT },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const product = await prisma.product.findUnique({
      where: { id: deletedItem.productId },
    });

    if (product) {
      await prisma.product.update({
        where: { id: deletedItem.productId },
        data: {
          avgRating: parseFloat((productReviews._avg?.rating ?? 0).toFixed(2)),
          ratingCount: productReviews._count.rating,
        },
      });

      // Update trainer rating (since product review is also trainer review)
      const trainerProducts = await prisma.product.findMany({
        where: { userId: product.userId },
        select: { id: true },
      });

      const trainerProductIds = trainerProducts.map(p => p.id);

      const trainerReviews = await prisma.review.aggregate({
        where: {
          productId: { in: trainerProductIds },
          type: ReviewType.PRODUCT,
        },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await prisma.trainer.update({
        where: { userId: product.userId },
        data: {
          avgRating: parseFloat((trainerReviews._avg?.rating ?? 0).toFixed(2)),
          ratingCount: trainerReviews._count.rating,
        },
      });
    }
  }

  return deletedItem;
};

export const reviewService = {
  // Product Reviews (also reviews the trainer who created the product)
  createProductReviewIntoDb,
  getProductReviewListFromDb,
  getTrainerReviewListFromDb,

  // System Reviews
  createSystemReviewIntoDb,
  getSystemReviewListFromDb,

  // Trainer Replies
  createTrainerReplyIntoDb,

  // Common
  updateReviewIntoDb,
  deleteReviewItemFromDb,
};

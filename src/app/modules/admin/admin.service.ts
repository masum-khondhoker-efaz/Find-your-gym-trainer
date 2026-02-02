import { Trainer } from './../../../../node_modules/.prisma/client/index.d';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination } from '../../utils/pagination';
import {
  buildSearchQuery,
  buildFilterQuery,
  combineQueries,
  buildDateRangeQuery,
} from '../../utils/searchFilter';
import {
  formatPaginationResponse,
  getPaginationQuery,
} from '../../utils/pagination';

const getDashboardStatsFromDb = async (
  userId: string,
  earningsYear?: string,
  usersYear?: string,
) => {
  const earningsYearNum = earningsYear ? parseInt(earningsYear, 10) : undefined;
  const usersYearNum = usersYear ? parseInt(usersYear, 10) : undefined;

  // totals for users/sellers remain global (no year split requested)
  const totalUsers = await prisma.user.count({
    where: {
      status: UserStatus.ACTIVE,
    },
  });

  const totalTrainers = await prisma.user.count({
    where: {
      role: UserRoleEnum.TRAINER,
      status: UserStatus.ACTIVE,
      isVerified: true,
    },
  });

  const targetEarningsYear: number | undefined =
    typeof earningsYearNum === 'number' && !Number.isNaN(earningsYearNum)
      ? earningsYearNum
      : undefined;
  const earningsYearStart =
    targetEarningsYear !== undefined
      ? new Date(targetEarningsYear, 0, 1)
      : undefined;
  const earningsYearEnd =
    targetEarningsYear !== undefined
      ? new Date(targetEarningsYear, 11, 31, 23, 59, 59, 999)
      : undefined;

  const targetUsersYear: number | undefined =
    typeof usersYearNum === 'number' && !Number.isNaN(usersYearNum)
      ? usersYearNum
      : undefined;
  const usersYearStart =
    targetUsersYear !== undefined ? new Date(targetUsersYear, 0, 1) : undefined;
  const usersYearEnd =
    targetUsersYear !== undefined
      ? new Date(targetUsersYear, 11, 31, 23, 59, 59, 999)
      : undefined;

  // totalEarnings: constrain by earningsYear if provided, otherwise overall
  const totalEarnings = await prisma.order.aggregate({
    _sum: {
      totalAmount: true,
    },
    ...(targetEarningsYear
      ? {
          where: {
            createdAt: { gte: earningsYearStart!, lte: earningsYearEnd! },
          },
        }
      : {}),
  });

  // earningGrowth: filter by earningsYear if provided; else last month
  const earningWhere: any = {
    status: PaymentStatus.COMPLETED,
    ...(targetEarningsYear
      ? { createdAt: { gte: earningsYearStart, lte: earningsYearEnd } }
      : {
          createdAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
          },
        }),
  };

  const earningGrowth = await prisma.payment.groupBy({
    by: ['createdAt'],
    _sum: {
      paymentAmount: true,
    },
    where: earningWhere,
    orderBy: { createdAt: 'asc' },
  });

  // recentUsers: filter by usersYear if provided; else last month
  const recentUsers = await prisma.user.findMany({
    where: {
      status: UserStatus.ACTIVE,
      ...(targetUsersYear
        ? { createdAt: { gte: usersYearStart, lte: usersYearEnd } }
        : {
            createdAt: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            },
          }),
    },
    select: {
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  });

  // Month bucket interfaces
  interface MonthBucket {
    label: string;
    year: number;
    month: number;
    total: number;
  }

  interface MonthBucketCount {
    label: string;
    year: number;
    month: number;
  }

  const addYearMonthsTo = (
    arr: { label: string; year: number; month: number; total?: number }[],
    y: number,
  ) => {
    for (let m = 0; m < 12; m++) {
      const d = new Date(y, m, 1);
      arr.push({
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        year: y,
        month: m,
        ...(arr === (arr as any) ? { total: 0 } : {}),
      } as any);
    }
  };

  // Build separate month arrays for earnings and users so each year filter only affects its own growth
  const monthsEarnings: MonthBucket[] = [];
  const monthsUsers: MonthBucketCount[] = [];

  // Build months for earnings
  if (targetEarningsYear !== undefined) {
    addYearMonthsTo(monthsEarnings, targetEarningsYear);
  } else {
    const now = new Date();
    const yearsSet = new Set<number>([now.getFullYear()]);
    earningGrowth.forEach(item => {
      const y = new Date(item.createdAt).getFullYear();
      yearsSet.add(y);
    });
    const years = Array.from(yearsSet).sort((a, b) => a - b);
    years.forEach(y => addYearMonthsTo(monthsEarnings as any, y));
  }

  // Build months for users
  if (targetUsersYear !== undefined) {
    addYearMonthsTo(monthsUsers as any, targetUsersYear);
  } else {
    const now = new Date();
    const yearsSet = new Set<number>([now.getFullYear()]);
    recentUsers.forEach(u => {
      yearsSet.add(u.createdAt.getFullYear());
    });
    const years = Array.from(yearsSet).sort((a, b) => a - b);
    years.forEach(y => addYearMonthsTo(monthsUsers as any, y));
  }

  // Map earningGrowth to monthsEarnings (summing into the correct year/month slot)
  earningGrowth.forEach(item => {
    const date = new Date(item.createdAt);
    const idx = monthsEarnings.findIndex(
      m => m.year === date.getFullYear() && m.month === date.getMonth(),
    );
    if (idx !== -1) {
      monthsEarnings[idx].total += item._sum?.paymentAmount || 0;
    }
  });

  // Prepare user growth per month with month name (count users per selected roles) using monthsUsers only
  const userGrowthByMonth: { month: string; role: string; count: number }[] =
    [];
  monthsUsers.forEach(month => {
    [UserRoleEnum.MEMBER, UserRoleEnum.TRAINER].forEach(role => {
      const count = recentUsers.filter(
        u =>
          u.roles.some(r => r.role?.name === role) &&
          u.createdAt.getFullYear() === month.year &&
          u.createdAt.getMonth() === month.month,
      ).length;
      userGrowthByMonth.push({
        month: month.label,
        role,
        count,
      });
    });
  });

  return {
    totalUsers,
    totalTrainers,
    totalEarnings: totalEarnings._sum.totalAmount || 0,
    earningGrowth: monthsEarnings.map(m => ({
      label: m.label,
      total: m.total,
    })),
    userGrowthByMonth,
  };
};

const getAllUsersFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields
  const searchFields = ['fullName', 'email', 'phoneNumber', 'address'];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    ...(options.userStatus && { status: options.userStatus }),
    ...(options.fullName && {
      fullName: {
        contains: options.fullName,
        mode: 'insensitive' as const,
      },
    }),
    ...(options.email && {
      email: {
        contains: options.email,
        mode: 'insensitive' as const,
      },
    }),
    ...(options.phoneNumber && {
      phoneNumber: {
        contains: options.phoneNumber,
        mode: 'insensitive' as const,
      },
    }),
    ...(options.address && {
      address: {
        contains: options.address,
        mode: 'insensitive' as const,
      },
    }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Date range filtering
  // const dateQuery = buildDateRangeQuery({
  //   startDate: options.startDate,
  //   endDate: options.endDate,
  //   dateField: 'createdAt',
  // });

  // Base query for BUYER role users
  const baseQuery = {
    role: UserRoleEnum.MEMBER,
    status: UserStatus.ACTIVE,
    // Exclude super admins
    NOT: {
      role: UserRoleEnum.SUPER_ADMIN,
    },
    // status: { not: UserStatus.PENDING },
  };

  // Combine all queries
  const whereQuery = combineQueries(
    baseQuery,
    searchQuery,
    filterQuery,
    // dateQuery,
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.user.count({ where: whereQuery });

  // Fetch paginated data
  const users = await prisma.user.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      bio: true,
      image: true,
      gymId: true,
      gymName: true,
      fitnessGoals: true,
      address: true,
      createdAt: true,
    },
  });

  return formatPaginationResponse(users, total, page, limit);
};

const getAUsersFromDb = async (userId: string, targetUserId: string) => {
  const result = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      role: UserRoleEnum.MEMBER,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      bio: true,
      image: true,
      gymId: true,
      gymName: true,
      fitnessGoals: true,
      address: true,
      createdAt: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  return result;
};

const getAllTrainersFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields in trainerProfile
  const searchFields = [
    'trainers.trainerSpecialties.specialty.specialtyName',
    'trainers.trainerServiceTypes.serviceTypes.serviceName',
    'user.fullName',
    'user.email',
  ];

  // For nested search, we need to handle it differently
  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            trainers: {
              trainerSpecialties: {
                specialty: {
                  specialtyName: {
                    contains: options.searchTerm,
                    mode: 'insensitive' as const,
                  },
                },
              },
            },
          },
          {
            trainers: {
              trainerServiceTypes: {
                serviceTypes: {
                  serviceName: {
                    contains: options.searchTerm,
                    mode: 'insensitive' as const,
                  },
                },
              },
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
          {
            user: {
              email: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
        ],
      }
    : {};

  // Build filter query for trainer-specific fields
  const filterQuery: Record<string, any> = {};

  if (options.isProfileComplete !== undefined) {
    filterQuery.trainers = {
      ...filterQuery.trainers,
      isProfileComplete:
        options.isProfileComplete === 'true' ||
        options.isProfileComplete === true,
    };
  }

  // Date range filtering for trainer profiles
  const dateQuery =
    options.startDate || options.endDate
      ? {
          trainers: {
            createdAt: {
              ...(options.startDate && { gte: new Date(options.startDate) }),
              ...(options.endDate && { lte: new Date(options.endDate) }),
            },
          },
        }
      : {};

  // Base query for TRAINER role users
  const baseQuery = {
    role: UserRoleEnum.TRAINER,
    status: UserStatus.ACTIVE,
    trainers: {
      // isNot: null, // Ensure trainer profile exists
      some: {},
    },
    // Exclude super admins
    NOT: {
      role: UserRoleEnum.SUPER_ADMIN,
    },
  };

  // Combine all queries
  const whereQuery = combineQueries(
    baseQuery,
    searchQuery,
    filterQuery,
    dateQuery,
  );

  // For sorting, we need to handle nested fields
  // Note: Prisma doesn't support ordering by relation fields directly
  // We'll order by User model fields instead
  let orderBy: any = {};
  if (sortBy === 'createdAt') {
    orderBy = {
      createdAt: sortOrder,
    };
  } else {
    orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;
  }

  // Fetch total count for pagination
  const total = await prisma.user.count({ where: whereQuery });

  // Fetch paginated data
  const result = await prisma.user.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      address: true,
      isProfileComplete: true,
      createdAt: true,
      trainers: {
        select: {
          id: true,
          userId: true,
          specialtyId: true,
          portfolio: true,
          certifications: true,
          experienceYears: true,
          createdAt: true,
          updatedAt: true,
          trainerSpecialties: {
            select: {
              specialty: {
                select: {
                  id: true,
                  specialtyName: true,
                },
              },
            },
          },
          trainerServiceTypes: {
            select: {
              serviceType: {
                select: {
                  id: true,
                  serviceName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Flatten the result to include user info with their trainer profiles
  const trainers = result.flatMap(user =>
    user.trainers.map(trainer => ({
      id: trainer.id,
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      address: user.address,
      isProfileComplete: user.isProfileComplete,
      specialtyId: trainer.specialtyId,
      portfolio: trainer.portfolio,
      certifications: trainer.certifications,
      experienceYears: trainer.experienceYears,
      specialty: trainer.trainerSpecialties.map(ts => ts.specialty),
      serviceTypes: trainer.trainerServiceTypes.map(tst => tst.serviceType),
      createdAt: trainer.createdAt,
      updatedAt: trainer.updatedAt,
    })),
  );

  return formatPaginationResponse(trainers, total, page, limit);
};

const getAllPostsFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  // Build search query for searchable fields
  const searchFields = ['content'];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });
  // Build filter query
  const filterFields: Record<string, any> = {
    ...(options.content && {
      content: {
        contains: options.content,
        mode: 'insensitive' as const,
      },
    }),
  };
  const filterQuery = buildFilterQuery(filterFields);
  // Date range filtering
  // const dateQuery = buildDateRangeQuery({
  //   startDate: options.startDate,
  //   endDate: options.endDate,
  //   dateField: 'createdAt',
  // });
  // Base query to fetch all posts
  const baseQuery = {};
  // Combine all queries
  const whereQuery = combineQueries(
    baseQuery,
    searchQuery,
    filterQuery,
    // dateQuery,
  );
  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;
  // Fetch total count for pagination
  const total = await prisma.post.count({ where: whereQuery });
  // Fetch paginated data
  const posts = await prisma.post.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      content: true,
      image: true,
      impressionCount: true,
      likeCount: true,
      commentCount: true,
      shareCount: true,
      isPublished: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
        },
      },
    },
  });
  return formatPaginationResponse(posts, total, page, limit);
};

const getAllProductsFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  //base query to only fetch visible products
  const baseQuery = {
    // isActive: false,
    userId: { not: userId },
  };
  // Build search query for searchable fields
  const searchFields = ['productName', 'description'];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    ...(options.productName && {
      productName: {
        contains: options.productName,
        mode: 'insensitive' as const,
      },
    }),
    ...(options.priceMin && { price: { gte: Number(options.priceMin) } }),
    ...(options.priceMax && { price: { lte: Number(options.priceMax) } }),
    ...(options.isActive !== undefined && {
      isActive: options.isActive === 'true' || options.isActive === true,
    }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Date range filtering
  // const dateQuery = buildDateRangeQuery({
  //   startDate: options.startDate,
  //   endDate: options.endDate,
  //   dateField: 'createdAt',
  // });

  // Combine all queries
  const whereQuery = combineQueries(
    baseQuery,
    searchQuery,
    filterQuery,
    // dateQuery,
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.product.count({ where: whereQuery });

  // Fetch paginated data
  const products = await prisma.product.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      productName: true,
      description: true,
      week: true,
      agreement: true,
      totalPurchased: true,
      views: true,
      price: true,
      discount: true,
      avgRating: true,
      ratingCount: true,
      productImage: true,
      productVideo: true,
      pdf: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      // userId: true,
      user: {
        select: {
          trainers: {
            select: {
              userId: true,
              specialtyId: true,
              portfolio: true,
              certifications: true,
              experienceYears: true,
              specialty: {
                select: {
                  id: true,
                  specialtyName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Flatten the products to include trainer info at the top level
    const flattenedProducts = products.map(product => {
      const trainer = product.user?.trainers?.[0];
      return {
        id: product.id,
        productName: product.productName,
        description: product.description,
        week: product.week,
        agreement: product.agreement,
        totalPurchased: product.totalPurchased,
        views: product.views,
        price: product.price,
        discount: product.discount,
        avgRating: product.avgRating,
        ratingCount: product.ratingCount,
        productImage: product.productImage,
        productVideo: product.productVideo,
        pdf: product.pdf,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        // trainer: trainer ? {
        //   userId: trainer.userId,
        //   specialtyId: trainer.specialtyId,
        //   portfolio: trainer.portfolio,
        //   certifications: trainer.certifications,
        //   experienceYears: trainer.experienceYears,
        //   specialty: trainer.specialty,
        // } : null,
      };
    });

    return formatPaginationResponse(flattenedProducts, total, page, limit);
};

const updateProductVisibilityIntoDb = async (
  userId: string,
  productId: string,
) => {
  const product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
  });
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const updatedProduct = await prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      isActive: !product.isActive,
    },
  });
  if (!updatedProduct) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to update product visibility',
    );
  }
  return updatedProduct;
};

const updateTrainerStatusIntoDb = async (
  userId: string,
  trainerId: string,
  // payload: { isProfileComplete: boolean },
) => {
  const trainer = await prisma.user.findUnique({
    where: {
      id: trainerId,
    },
  });
  if (!trainer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Trainer not found');
  }

  const updatedTrainer = await prisma.user.update({
    where: {
      id: trainerId,
    },
    data: {
      isProfileComplete: !trainer.isProfileComplete,
    },
    include: {
      trainers: {
        select: {
          id: true,
          userId: true,
          specialtyId: true,
          portfolio: true,
          certifications: true,
          experienceYears: true,
          createdAt: true,
          updatedAt: true,
          trainerSpecialties: {
            select: {
              specialty: {
                select: {
                  id: true,
                  specialtyName: true,
                },
              },
            },
          },
          trainerServiceTypes: {
            select: {
              serviceType: {
                select: {
                  id: true,
                  serviceName: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!updatedTrainer) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to update trainer status',
    );
  }

  return {
    isProfileComplete: updatedTrainer.isProfileComplete,
    ...updatedTrainer.trainers[0],
  };
};

const getATrainerFromDb = async (userId: string, trainerId: string) => {
  const result = await prisma.user.findUnique({
    where: {
      id: trainerId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      address: true,
      isProfileComplete: true,
      createdAt: true,
      trainers: {
        select: {
          id: true,
          userId: true,
          specialtyId: true,
          portfolio: true,
          certifications: true,
          experienceYears: true,
          createdAt: true,
          updatedAt: true,
          trainerSpecialties: {
            select: {
              specialty: {
                select: {
                  id: true,
                  specialtyName: true,
                },
              },
            },
          },
          trainerServiceTypes: {
            select: {
              serviceType: {
                select: {
                  id: true,
                  serviceName: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Trainer not found');
  }

  // Flatten the result
  const trainer = result.trainers[0];
  if (!trainer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Trainer profile not found');
  }

  return {
    id: trainer.id,
    userId: result.id,
    fullName: result.fullName,
    email: result.email,
    phoneNumber: result.phoneNumber,
    address: result.address,
    isProfileComplete: result.isProfileComplete,
    specialtyId: trainer.specialtyId,
    portfolio: trainer.portfolio,
    certifications: trainer.certifications,
    experienceYears: trainer.experienceYears,
    specialty: trainer.trainerSpecialties.map(ts => ts.specialty),
    serviceTypes: trainer.trainerServiceTypes.map(tst => tst.serviceType),
    createdAt: trainer.createdAt,
    updatedAt: trainer.updatedAt,
  };
};

const getAllOrdersFromDb = async (userId: string, adminId: string) => {
  const result = await prisma.order.findMany({
    include: {
      items: {
        include: {
          product: { select: { id: true, productName: true, price: true } },
        },
      },
      user: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
  if (result.length === 0) {
    return { message: 'No order found' };
  }
  return result;
};

const getAOrderFromDb = async (userId: string, orderId: string) => {
  const result = await prisma.order.findFirst({
    where: {
      id: orderId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }
  return result;
};

const getAllNewsletterSubscribersFromDb = async (
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for newsletter subscriber fields
  const searchFields = ['email'];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    // Add any newsletter subscriber-specific filters here
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Combine all queries
  const whereQuery = combineQueries(searchQuery, filterQuery);

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.newsletterSubscriber.count({ where: whereQuery });

  // Fetch paginated data
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
  });

  return formatPaginationResponse(subscribers, total, page, limit);
};

const updateUserStatusIntoDb = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  const newStatus =
    user.status === UserStatus.ACTIVE ? UserStatus.BLOCKED : UserStatus.ACTIVE;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus },
  });
  if (!updatedUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update user status');
  }
  return updatedUser;
};

const updatePostStatusIntoDb = async (userId: string, postId: string) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
  }

  // Toggle the isPublished status (true -> false, false -> true)
  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: { isPublished: !post.isPublished },
  });
  if (!updatedPost) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update post status');
  }
  return updatedPost;
};

const deleteAdminItemFromDb = async (userId: string, adminId: string) => {
  const deletedItem = await prisma.admin.delete({
    where: {
      id: adminId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'adminId, not deleted');
  }

  return deletedItem;
};

export const adminService = {
  getDashboardStatsFromDb,
  getAllUsersFromDb,
  getAUsersFromDb,
  getAllTrainersFromDb,
  getAllPostsFromDb,
  getAllProductsFromDb,
  updateProductVisibilityIntoDb,
  updateTrainerStatusIntoDb,
  getATrainerFromDb,
  getAllOrdersFromDb,
  getAOrderFromDb,
  getAllNewsletterSubscribersFromDb,
  updateUserStatusIntoDb,
  updatePostStatusIntoDb,
  deleteAdminItemFromDb,
};

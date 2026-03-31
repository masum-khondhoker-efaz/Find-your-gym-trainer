import { TrainerSpecialty } from './../../../../node_modules/.prisma/client/index.d';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus, PaymentStatus, OrderStatus, ProductStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { stat } from 'node:fs';
import { image } from 'pdfkit';

// Haversine formula to calculate distance between two coordinates
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

const getTrainersListFromDb = async (
  // userId: string,
  options: ISearchAndFilterOptions,
) => {
  const limit = Number(options?.limit || 10);
  const offset = options?.page
    ? (Number(options.page) - 1) * limit
    : Number(options?.offset || 0);

  const whereClause: any = {
    role: UserRoleEnum.TRAINER,
    status: UserStatus.ACTIVE,
    isProfileComplete: true,
    isVerified: true,
    trainers: {
      some: {},
    },
  };

  // Search filter
  if (options?.searchTerm) {
    whereClause.OR = [
      { fullName: { contains: options.searchTerm, mode: 'insensitive' } },
      { email: { contains: options.searchTerm, mode: 'insensitive' } },
      { bio: { contains: options.searchTerm, mode: 'insensitive' } },
    ];
  }

  // Trainer name filter
  if (options?.trainerName) {
    whereClause.fullName = {
      contains: options.trainerName,
      mode: 'insensitive',
    };
  }

  // Email filter
  if (options?.email) {
    whereClause.email = { contains: options.email, mode: 'insensitive' };
  }

  // Service type filter
  if (options?.serviceName || options?.trainerServiceTypes) {
    whereClause.trainers = {
      some: {
        trainerServiceTypes: {
          some: {
            serviceType: {
              serviceName: options.serviceName || options.trainerServiceTypes,
            },
          },
        },
      },
    };
  }

  // Specialty filter
  if (options?.specialtyName) {
    whereClause.trainers = {
      some: {
        trainerSpecialties: {
          some: {
            specialty: {
              specialtyName: options.specialtyName || options.trainerSpecialties,
            },
          },
        },
      },
    };
  }

  // Filter by certification/organization name
  if (options.certification) {
    whereClause.trainers = {
      ...(whereClause.trainers || {}),
      some: {
        ...(whereClause.trainers?.some || {}),
        orgName: {
          contains: options.certification,
          mode: 'insensitive' as const,
        },
      },
    };
  }

  // Filter by ratings
  // Handle rating range filter
  if (options.minRating !== undefined || options.maxRating !== undefined) {
    const ratingFilter: any = {};
    if (options.minRating !== undefined) {
      ratingFilter.gte = Number(options.minRating);
    }
    if (options.maxRating !== undefined) {
      ratingFilter.lte = Number(options.maxRating);
    }
    whereClause.trainers = {
      some: {
        ...whereClause.trainers?.some,
        avgRating: ratingFilter,
      },
    };
  }

  // Experience years filter
  if (options?.experienceYears !== undefined) {
    whereClause.trainers = {
      some: {
        ...whereClause.trainers?.some,
        experienceYears: {
          gte: Number(options.experienceYears),
        },
      },
    };
  }

  const sortBy = options?.sortBy || 'createdAt';
  const sortOrder = options?.sortOrder || 'desc';

  // Fetch all trainers first (we'll filter by distance in memory)
  const allTrainers = await prisma.user.findMany({
    where: whereClause,
    include: {
      trainers: {
        include: {
          trainerSpecialties: {
            include: {
              specialty: true,
            },
          },
          trainerServiceTypes: {
            include: {
              serviceType: true,
            },
          },

          gym: {
            select: {
              gymName: true,
              gymAddress: true,
              imageUrl: true,
              latitude: true,
              longitude: true,
              googlePlaceId: true,
            },
          }
        },
      },
      socialAccounts: {
        select: {
          platformType: true,
          platformUrl: true,
        },
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const userLatitude = options?.latitude ? Number(options.latitude) : null;
  const userLongitude = options?.longitude ? Number(options.longitude) : null;
  const radiusInKm = Number(options?.distanceInKm || 50); // Default 50km
  const hasLocationFilter = userLatitude !== null && userLongitude !== null && !isNaN(userLatitude) && !isNaN(userLongitude);

  let filteredTrainers: any[] = allTrainers;

  if (hasLocationFilter) {
    filteredTrainers = allTrainers
      .map(trainer => {
        if (trainer.latitude && trainer.longitude) {
          console.log(trainer.fullName, trainer.latitude, trainer.longitude);
          const distance = calculateDistance(
            userLatitude!,
            userLongitude!,
            trainer.latitude,
            trainer.longitude,
          );
          return { ...trainer, distance };
        }
        return null;
      })
      .filter(
        (trainer): trainer is NonNullable<typeof trainer> =>
          trainer !== null && trainer.distance <= radiusInKm,
      )
      .sort((a, b) => a.distance - b.distance); // Sort by nearest first
  }

  const total = filteredTrainers.length;
  const result = filteredTrainers.slice(offset, offset + limit);

  const totalPages = Math.ceil(total / limit);
  const page = Number(options?.page || Math.floor(offset / limit) + 1);

  // Format the response
  const formattedResult = result.map(user => {
    const trainer = user.trainers[0];
    const serviceTypes = trainer?.trainerServiceTypes?.map((tst: any) => ({
      id: tst.serviceType.id,
      serviceName: tst.serviceType.serviceName,
    }));

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      image: user.image,
      isSubscribed: true,
      bio: user.bio,
      phoneNumber: user.phoneNumber,
      address: user.address,
      distance: hasLocationFilter ? ((user as any).distance)?.toFixed(2) || null : null,
      experienceYears: trainer?.experienceYears,
      avgRating: trainer?.avgRating,
      ratingCount: trainer?.ratingCount,
      totalReferrals: trainer?.totalReferrals,
      views: trainer?.views,
      orgName: trainer.orgName,
      credentialNo: trainer.credentialNo,
      gym: {
      gymName: trainer?.gym?.gymName,
      gymAddress: trainer?.gym?.gymAddress,
      imageUrl: trainer?.gym?.imageUrl,
      latitude: trainer?.gym?.latitude,
      longitude: trainer?.gym?.longitude,
      googlePlaceId: trainer?.gym?.googlePlaceId,
    },
      specialty: trainer?.trainerSpecialties.map((ts: any) => ({
        id: ts.specialty.id,
        specialtyName: ts.specialty.specialtyName,
      })),
      serviceTypes: serviceTypes || [],
      portfolio: trainer?.portfolio || [],
      certifications: trainer?.certifications || [],
      socialAccounts: user.socialAccounts || [],
    };
  });

  return {
    data: formattedResult,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

const getTrainersByIdFromDb = async (
  // userId: string, 
  trainersId: string) => {
  const result = await prisma.trainer.findUnique({
    where: {
      userId: trainersId,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          bio: true,
          isSubscribed: true,
          phoneNumber: true,
          address: true,
          socialAccounts: {
            select: {
              platformType: true,
              platformUrl: true,
            },
          }
        },
      },
      trainerSpecialties: {
        include: {
          specialty: true,
        },
      },
      trainerServiceTypes: {
        include: {
          serviceType: true,
        },
      },
      gym: {
        select: {
          gymName: true,
          gymAddress: true,
          imageUrl: true,
          latitude: true,
          longitude: true,
          googlePlaceId: true,
        },
      
    }
    },
    
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'trainers not found');
  }

  // update views count
  const updated = await prisma.trainer.update({
    where: {
      userId: trainersId,
    },
    data: {
      views: {
        increment: 1,
      },
    },
  });
  

  return {
    id: result.user.id,
    fullName: result.user.fullName,
    email: result.user.email,
    image: result.user.image,
    bio: result.user.bio,
    isSubscribed: true,
    phoneNumber: result.user.phoneNumber,
    address: result.user.address,
    gym: {
      gymName: result.gym?.gymName,
      gymAddress: result.gym?.gymAddress,
      imageUrl: result.gym?.imageUrl,
      latitude: result.gym?.latitude,
      longitude: result.gym?.longitude,
      googlePlaceId: result.gym?.googlePlaceId,
    },
    // trainerId: result.id,
    experienceYears: result.experienceYears,
    avgRating: result.avgRating,
    ratingCount: result.ratingCount,
    totalReferrals: result.totalReferrals,
    views: updated.views,
    organizationName: result.orgName,
    credentialNumber: result.credentialNo,
    specialty: result.trainerSpecialties.map(ts => ({
      id: ts.specialty.id,
      specialtyName: ts.specialty.specialtyName,
    })),
    serviceTypes: result.trainerServiceTypes.map(tst => ({
      id: tst.serviceType.id,
      serviceName: tst.serviceType.serviceName,
    })),
    portfolio: result.portfolio,
    certifications: result.certifications,
    socialAccounts: result.user.socialAccounts || [],
  };
};

const getMemberListFromDb = async (
  // userId: string,
  options: ISearchAndFilterOptions,
) => {
  const limit = Number(options?.limit || 10);
  const offset = options?.page
    ? (Number(options.page) - 1) * limit
    : Number(options?.offset || 0);

  const whereClause: any = {
    role: UserRoleEnum.TRAINER,
    status: UserStatus.ACTIVE,
    isProfileComplete: true,
    isVerified: true,
    trainers: {
      some: {},
    },
  };

  // Search filter
  if (options?.searchTerm) {
    whereClause.OR = [
      { fullName: { contains: options.searchTerm, mode: 'insensitive' } },
      { email: { contains: options.searchTerm, mode: 'insensitive' } },
      { bio: { contains: options.searchTerm, mode: 'insensitive' } },
    ];
  }

  // Trainer name filter
  if (options?.trainerName) {
    whereClause.fullName = {
      contains: options.trainerName,
      mode: 'insensitive',
    };
  }

  // Email filter
  if (options?.email) {
    whereClause.email = { contains: options.email, mode: 'insensitive' };
  }

  // Service type filter
  if (options?.serviceName || options?.trainerServiceTypes) {
    whereClause.trainers = {
      some: {
        trainerServiceTypes: {
          some: {
            serviceType: {
              serviceName: options.serviceName || options.trainerServiceTypes,
            },
          },
        },
      },
    };
  }

  // Specialty filter
  if (options?.specialtyName) {
    whereClause.trainers = {
      some: {
        trainerSpecialties: {
          some: {
            specialty: {
              specialtyName: options.specialtyName || options.trainerSpecialties,
            },
          },
        },
      },
    };
  }

  // Experience years filter
  if (options?.experienceYears !== undefined) {
    whereClause.trainers = {
      some: {
        ...whereClause.trainers?.some,
        experienceYears: {
          gte: Number(options.experienceYears),
        },
      },
    };
  }

  const sortBy = options?.sortBy || 'createdAt';
  const sortOrder = options?.sortOrder || 'desc';

  // Fetch all trainers first (we'll filter by distance in memory)
  const allTrainers = await prisma.user.findMany({
    where: whereClause,
    include: {
      trainers: {
        include: {
          trainerSpecialties: {
            include: {
              specialty: true,
            },
          },
          trainerServiceTypes: {
            include: {
              serviceType: true,
            },
          },
        },
      },
      socialAccounts: {
        select: {
          platformType: true,
          platformUrl: true,
        },
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const userLatitude = options?.latitude ? Number(options.latitude) : null;
  const userLongitude = options?.longitude ? Number(options.longitude) : null;
  const radiusInKm = Number(options?.distanceInKm || 50); // Default 50km
  const hasLocationFilter = userLatitude !== null && userLongitude !== null && !isNaN(userLatitude) && !isNaN(userLongitude);

  let filteredTrainers: any[] = allTrainers;

  if (hasLocationFilter) {
    filteredTrainers = allTrainers
      .map(trainer => {
        if (trainer.latitude && trainer.longitude) {
          console.log(trainer.fullName, trainer.latitude, trainer.longitude);
          const distance = calculateDistance(
            userLatitude!,
            userLongitude!,
            trainer.latitude,
            trainer.longitude,
          );
          return { ...trainer, distance };
        }
        return null;
      })
      .filter(
        (trainer): trainer is NonNullable<typeof trainer> =>
          trainer !== null && trainer.distance <= radiusInKm,
      )
      .sort((a, b) => a.distance - b.distance); // Sort by nearest first
  }

  const total = filteredTrainers.length;
  const result = filteredTrainers.slice(offset, offset + limit);

  const totalPages = Math.ceil(total / limit);
  const page = Number(options?.page || Math.floor(offset / limit) + 1);

  // Format the response
  const formattedResult = result.map(user => {
    const trainer = user.trainers[0];
    const serviceTypes = trainer?.trainerServiceTypes?.map((tst: any) => ({
      id: tst.serviceType.id,
      serviceName: tst.serviceType.serviceName,
    }));

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      image: user.image,
      bio: user.bio,
      phoneNumber: user.phoneNumber,
      address: user.address,
      distance: hasLocationFilter ? ((user as any).distance)?.toFixed(2) || null : null,
      experienceYears: trainer?.experienceYears,
      avgRating: trainer?.avgRating,
      ratingCount: trainer?.ratingCount,
      totalReferrals: trainer?.totalReferrals,
      views: trainer?.views,
      specialty: trainer?.trainerSpecialties.map((ts: any) => ({
        id: ts.specialty.id,
        specialtyName: ts.specialty.specialtyName,
      })),
      serviceTypes: serviceTypes || [],
      portfolio: trainer?.portfolio || [],
      certifications: trainer?.certifications || [],
      socialAccounts: user.socialAccounts || [],
    };
  });

  return {
    data: formattedResult,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

const getTrainerEarningsFromDb = async (
  trainerId: string,
  options: ISearchAndFilterOptions,
) => {
  const year = Number((options as any)?.year || new Date().getFullYear());

  if (!Number.isFinite(year) || year < 1900 || year > 3000) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid year');
  }

  const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));

  const prevStartDate = new Date(Date.UTC(year - 1, 0, 1, 0, 0, 0));
  const prevEndDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));

  const [currentYearPayments, previousYearPayments] = await Promise.all([
    (prisma as any).order.findMany({
      where: {
        trainerId,
        paymentStatus: PaymentStatus.COMPLETED,
        status: OrderStatus.COMPLETED,
        createdAt: { gte: startDate, lt: endDate },
      },
      select: {
        totalPrice: true,
        createdAt: true,
      },
    }),
    (prisma as any).order.findMany({
      where: {
        trainerId,
        paymentStatus: PaymentStatus.COMPLETED,
        status: OrderStatus.COMPLETED,
        createdAt: { gte: prevStartDate, lt: prevEndDate },
      },
      select: {
        totalPrice: true,
        createdAt: true,
      },
    }),
  ]);

  const monthlyRevenue = Array(12).fill(0);

  for (const p of currentYearPayments) {
    const totalPrice = Number(p.totalPrice || 0);
    const monthIndex = new Date(p.createdAt).getUTCMonth();
    monthlyRevenue[monthIndex] += totalPrice;
  }

  const totalRevenue = monthlyRevenue.reduce((sum, v) => sum + v, 0);
  const monthlyAverage = totalRevenue / 12;

  const previousYearTotal = previousYearPayments.reduce(
    (sum: number, p: any) => sum + Number(p.totalPrice || 0),
    0,
  );

  const growthRate =
    previousYearTotal > 0
      ? ((totalRevenue - previousYearTotal) / previousYearTotal) * 100
      : totalRevenue > 0
      ? 100
      : 0;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const q1 = monthlyRevenue[0] + monthlyRevenue[1] + monthlyRevenue[2];
  const q2 = monthlyRevenue[3] + monthlyRevenue[4] + monthlyRevenue[5];
  const q3 = monthlyRevenue[6] + monthlyRevenue[7] + monthlyRevenue[8];
  const q4 = monthlyRevenue[9] + monthlyRevenue[10] + monthlyRevenue[11];

  return {
    year,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    monthlyAverage: Number(monthlyAverage.toFixed(2)),
    growthRate: Number(growthRate.toFixed(2)),
    revenueOverview: {
      line: {
        labels: months,
        data: monthlyRevenue.map(v => Number(v.toFixed(2))),
      },
      bar: {
        labels: months,
        data: monthlyRevenue.map(v => Number(v.toFixed(2))),
      },
      pie: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        data: [q1, q2, q3, q4].map(v => Number(v.toFixed(2))),
      },
    },
  };
};

const getTrainerRecentTransactionsFromDb = async (trainerId: string) => {
  const transactions = await (prisma as any).order.findMany({
    where: {
      trainerId,
      paymentStatus: PaymentStatus.COMPLETED,
      status: OrderStatus.COMPLETED,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
    select: {
      id: true,
      totalPrice: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
        },
      },
      product: {
        select: {
          id: true,
          productName: true,
        },
      },
    },
  });

  // Format transactions 
   const formattedTransactions = transactions.map((tx: typeof transactions[0]) => ({
    id: tx.id,
    totalPrice: Number(tx.totalPrice.toFixed(2)),
    createdAt: tx.createdAt,
    customer: {
      id: tx.user.id,
      fullName: tx.user.fullName,
      email: tx.user.email,
      image: tx.user.image,
    },
    product: {
      id: tx.product.id,
      productName: tx.product.productName,
    },
  }));

  return formattedTransactions;
};

const getTrainerDashboardFromDb = async (trainerId: string) => {
  // Get all products for this trainer
  const trainerProducts = await (prisma as any).product.findMany({
    where: {
      userId: trainerId,
      isActive: true,
      status: ProductStatus.ACTIVE,
    },
    select: {
      id: true,
      capacity: true,
      totalPurchased: true,
      durationWeeks: true,
    },
  });

  // Calculate total capacity and active clients across all products
  const totalCapacity = trainerProducts.reduce(
    (sum: number, p: any) => sum + (p.capacity || 0),
    0,
  );
  
  const activeClients = trainerProducts.reduce(
    (sum: number, p: any) => sum + (p.totalPurchased || 0),
    0,
  );
  
  const spotsRemaining = totalCapacity - activeClients;

  // Calculate total weeks across all products
  const totalWeeks = trainerProducts.reduce(
    (sum: number, p: any) => sum + (p.durationWeeks || 0),
    0,
  );

  // Get this month's revenue
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Get last month's revenue for comparison
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [thisMonthOrders, lastMonthOrders] = await Promise.all([
    (prisma as any).order.findMany({
      where: {
        trainerId,
        paymentStatus: PaymentStatus.COMPLETED,
        status: OrderStatus.COMPLETED,
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
      select: {
        totalPrice: true,
      },
    }),
    (prisma as any).order.findMany({
      where: {
        trainerId,
        paymentStatus: PaymentStatus.COMPLETED,
        status: OrderStatus.COMPLETED,
        createdAt: {
          gte: startOfLastMonth,
          lt: endOfLastMonth,
        },
      },
      select: {
        totalPrice: true,
      },
    }),
  ]);

  const thisMonthRevenue = thisMonthOrders.reduce(
    (sum: number, o: any) => sum + Number(o.totalPrice || 0),
    0,
  );

  const lastMonthRevenue = lastMonthOrders.reduce(
    (sum: number, o: any) => sum + Number(o.totalPrice || 0),
    0,
  );

  // Calculate percentage change
  const revenueChangePercent =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : thisMonthRevenue > 0
      ? 100
      : 0;

  // Get trainer rating data
  const trainerData = await prisma.trainer.findUnique({
    where: {
      userId: trainerId,
    },
    select: {
      avgRating: true,
      ratingCount: true,
    },
  });

  // Count total products and products sold this month
  const totalProducts = trainerProducts.length;
  const productsSoldThisMonth = thisMonthOrders.length;

  return {
    activeClients: {
      current: activeClients,
      total: totalCapacity,
      spotsRemaining: spotsRemaining,
      message: `${activeClients}/${totalCapacity}, ${spotsRemaining} spots remaining from all products`,
    },
    thisMonthRevenue: {
      amount: Number(thisMonthRevenue.toFixed(2)),
      changePercent: Number(revenueChangePercent.toFixed(2)),
      message: `$${thisMonthRevenue.toFixed(2)} (${revenueChangePercent >= 0 ? '+' : ''}${revenueChangePercent.toFixed(0)}% from last month)`,
    },
    averageRating: {
      rating: trainerData?.avgRating || 0,
      totalReviews: trainerData?.ratingCount || 0,
      message: `${trainerData?.avgRating?.toFixed(1) || '0.0'} based on ${trainerData?.ratingCount || 0} reviews`,
    },
    productsSold: {
      soldThisMonth: productsSoldThisMonth,
      totalProducts: totalProducts,
      message: `${productsSoldThisMonth} (total ${totalProducts} products)`,
    },
    totalWeeks: {
      weeks: totalWeeks,
      message: `${totalWeeks} (total durationOfWeeks from all products)`,
    },
  };
};

export const trainersService = {
  getTrainersListFromDb,
  getTrainersByIdFromDb,
  getMemberListFromDb,
  getTrainerEarningsFromDb,
  getTrainerRecentTransactionsFromDb,
  getTrainerDashboardFromDb,
};

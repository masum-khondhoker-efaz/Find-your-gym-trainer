import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

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
  const limit = options?.limit || 10;
  const offset = options?.page
    ? (options.page - 1) * limit
    : options?.offset || 0;

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
  if (options?.serviceName || options?.trainerServiceType) {
    whereClause.trainers = {
      some: {
        trainerServiceTypes: {
          some: {
            serviceType: {
              serviceName: options.serviceName || options.trainerServiceType,
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
        ...whereClause.trainers?.some,
        specialty: {
          specialtyName: options.specialtyName,
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
          specialty: true,
          trainerServiceTypes: {
            include: {
              serviceType: true,
            },
          },
        },
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  // Filter by distance if latitude and longitude are provided
  let filteredTrainers = allTrainers;
  const userLatitude = options?.latitude;
  const userLongitude = options?.longitude;
  const radiusInKm = options?.distanceInKm || 50; // Default 50km

  if (userLatitude !== undefined && userLongitude !== undefined) {
    filteredTrainers = allTrainers
      .map(trainer => {
        if (trainer.latitude && trainer.longitude) {
          const distance = calculateDistance(
            userLatitude,
            userLongitude,
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
  const page = options?.page || Math.floor(offset / limit) + 1;

  // Format the response
  const formattedResult = result.map(user => {
    const trainer = user.trainers[0];
    const serviceTypes = trainer?.trainerServiceTypes?.map(tst => ({
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
      latitude: user.latitude,
      longitude: user.longitude,
      distance: ((user as any).distance)?.toFixed(2) || null,
      trainerId: trainer?.id,
      experienceYears: trainer?.experienceYears,
      avgRating: trainer?.avgRating,
      ratingCount: trainer?.ratingCount,
      totalReferrals: trainer?.totalReferrals,
      views: trainer?.views,
      specialty: trainer?.specialty
        ? {
            id: trainer.specialty.id,
            specialtyName: trainer.specialty.specialtyName,
          }
        : null,
      serviceTypes: serviceTypes || [],
      portfolio: trainer?.portfolio || [],
      certifications: trainer?.certifications || [],
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
          phoneNumber: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      },
      specialty: true,
      trainerServiceTypes: {
        include: {
          serviceType: true,
        },
      },
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
    phoneNumber: result.user.phoneNumber,
    address: result.user.address,
    latitude: result.user.latitude,
    longitude: result.user.longitude,
    trainerId: result.id,
    experienceYears: result.experienceYears,
    avgRating: result.avgRating,
    ratingCount: result.ratingCount,
    totalReferrals: result.totalReferrals,
    views: updated.views,
    specialty: result.specialty
      ? {
          id: result.specialty.id,
          specialtyName: result.specialty.specialtyName,
        }
      : null,
    serviceTypes: result.trainerServiceTypes.map(tst => ({
      id: tst.serviceType.id,
      serviceName: tst.serviceType.serviceName,
    })),
    portfolio: result.portfolio,
    certifications: result.certifications,
  };
};

export const trainersService = {
  getTrainersListFromDb,
  getTrainersByIdFromDb,
};

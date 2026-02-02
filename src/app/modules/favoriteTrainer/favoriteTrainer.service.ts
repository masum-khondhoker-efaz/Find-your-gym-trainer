import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createFavoriteTrainerIntoDb = async (userId: string, data: any) => {
  // Check if favoriteTrainer with the same trainerId already exists for the user
  const existingFavorite = await prisma.favoriteTrainer.findFirst({
    where: {
      userId: userId,
      trainerId: data.trainerId,
    },
  });

  if (existingFavorite) {
    return existingFavorite;
  }
  const result = await prisma.favoriteTrainer.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteTrainer not created');
  }
  return result;
};

const getFavoriteTrainerListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const skip = (Number(page) - 1) * Number(limit);

  const favoriteTrainers = await prisma.favoriteTrainer.findMany({
    where: {
      userId: userId,
    },
    skip,
    take: Number(limit),
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      trainer: {
        select: {
          userId: true,
          experienceYears: true,
          avgRating: true,
          ratingCount: true,
          totalReferrals: true,
          views: true,
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
          portfolio: true,
          certifications: true,
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
        },
      },
    },
  });

  const result = favoriteTrainers.map((favorite) => ({
    id: favorite.id,
    userId: favorite.userId,
    trainerId: favorite.trainerId,
    createdAt: favorite.createdAt,
    updatedAt: favorite.updatedAt,
    experienceYears: favorite.trainer.experienceYears,
    avgRating: favorite.trainer.avgRating,
    ratingCount: favorite.trainer.ratingCount,
    totalReferrals: favorite.trainer.totalReferrals,
    views: favorite.trainer.views,
    trainerSpecialties: favorite.trainer.trainerSpecialties.map(ts => ts.specialty),
    trainerServiceTypes: favorite.trainer.trainerServiceTypes.map(tst => tst.serviceType),
    portfolio: favorite.trainer.portfolio,
    certifications: favorite.trainer.certifications,
    trainerUserId: favorite.trainer.user.id,
    fullName: favorite.trainer.user.fullName,
    email: favorite.trainer.user.email,
    image: favorite.trainer.user.image,
    bio: favorite.trainer.user.bio,
    phoneNumber: favorite.trainer.user.phoneNumber,
    address: favorite.trainer.user.address,
    latitude: favorite.trainer.user.latitude,
    longitude: favorite.trainer.user.longitude,
  }));

  const total = await prisma.favoriteTrainer.count({
    where: {
      userId: userId,
    },
  });

  const totalPages = Math.ceil(total / limit);

  return {
    data: result,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: totalPages,
      hasNextPage: Number(page) < totalPages,
      hasPrevPage: Number(page) > 1,
    },
  };
};

const deleteFavoriteTrainerItemFromDb = async (
  userId: string,
  favoriteTrainerId: string,
) => {
  // check if favoriteTrainer exists
  const existingFavoriteTrainer = await prisma.favoriteTrainer.findFirst({
    where: {
      trainerId: favoriteTrainerId,
      userId: userId,
    },
  });
  if (!existingFavoriteTrainer) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'favoriteTrainerId not found',
    );
  }
  const deletedItem = await prisma.favoriteTrainer.deleteMany({
    where: {
      trainerId: favoriteTrainerId,
      userId: userId,
    },
  });
  if (deletedItem.count === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'favoriteTrainerId, not deleted',
    );
  }

  return deletedItem;
};

export const favoriteTrainerService = {
  createFavoriteTrainerIntoDb,
  getFavoriteTrainerListFromDb,
  deleteFavoriteTrainerItemFromDb,
};

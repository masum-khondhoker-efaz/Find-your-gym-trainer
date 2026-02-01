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

  const result = await prisma.favoriteTrainer.findMany({
    where: {
      userId: userId,
    },
    skip,
    take: Number(limit),
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      trainer: true,
    },
  });

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

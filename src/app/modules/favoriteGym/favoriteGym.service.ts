import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  calculatePagination,
  formatPaginationResponse,
  getPaginationQuery,
} from '../../utils/pagination';

type FavoriteGymPayload = {
  gymName: string;
  gymAddress: string;
  latitude: number;
  longitude: number;
  googlePlaceId: string;
  imageUrl: string;
};

const createFavoriteGymIntoDb = async (
  userId: string,
  data: FavoriteGymPayload,
) => {
  const existingFavoriteGym = await prisma.favoriteGyms.findFirst({
    where: {
      userId,
      googlePlaceId: data.googlePlaceId,
    },
  });

  if (existingFavoriteGym) {
    return existingFavoriteGym;
  }

  const result = await prisma.favoriteGyms.create({
    data: {
      userId,
      gymName: data.gymName,
      gymAddress: data.gymAddress,
      latitude: data.latitude,
      longitude: data.longitude,
      googlePlaceId: data.googlePlaceId,
      imageUrl: data.imageUrl,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Favorite gym not created');
  }

  return result;
};

const getFavoriteGymListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {},
) => {
  const normalizedOptions = {
    ...options,
    sortBy: options.sortBy || 'createdAt',
    sortOrder: options.sortOrder || 'desc',
  };

  const { page, limit, skip, sortBy, sortOrder } =
    calculatePagination(normalizedOptions);

  const whereConditions: Record<string, unknown> = {
    userId,
  };

  if (options.gymName) {
    whereConditions.gymName = {
      contains: options.gymName,
      mode: 'insensitive',
    };
  }

  if (options.searchTerm) {
    whereConditions.OR = [
      {
        gymName: {
          contains: options.searchTerm,
          mode: 'insensitive',
        },
      },
      {
        gymAddress: {
          contains: options.searchTerm,
          mode: 'insensitive',
        },
      },
    ];
  }

  const total = await prisma.favoriteGyms.count({
    where: whereConditions,
  });

  const result = await prisma.favoriteGyms.findMany({
    where: {
      ...whereConditions,
    },
    ...getPaginationQuery(sortBy, sortOrder),
    skip,
    take: limit,
  });

  return formatPaginationResponse(result, total, page, limit);
};

const deleteFavoriteGymItemFromDb = async (userId: string, favoriteGymId: string) => {
  const existingFavoriteGym = await prisma.favoriteGyms.findFirst({
    where: {
      id: favoriteGymId,
      userId,
    },
  });

  if (!existingFavoriteGym) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite gym not found');
  }

  const deletedItem = await prisma.favoriteGyms.delete({
    where: {
      id: favoriteGymId,
    },
  });

  return deletedItem;
};

export const favoriteGymService = {
  createFavoriteGymIntoDb,
  getFavoriteGymListFromDb,
  deleteFavoriteGymItemFromDb,
};
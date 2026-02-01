import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createFavoriteProductIntoDb = async (userId: string, data: any) => {
  // Check if favoriteProduct with the same productId already exists for the user
  const existingFavorite = await prisma.favoriteProduct.findFirst({
    where: {
      userId: userId,
      productId: data.productId,
    },
  });

  if (existingFavorite) {
    return existingFavorite;
  }

  const result = await prisma.favoriteProduct.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteProduct not created');
  }
  return result;
};

const getFavoriteProductListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
  
  const skip = (Number(page) - 1) * Number(limit);
  
  const result = await prisma.favoriteProduct.findMany({
    where: {
      userId: userId,
    },
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          description: true,
          price: true,
          productImage: true,
          productVideo : true,
        },
      },
    },
    skip: skip,
    take: Number(limit),
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const total = await prisma.favoriteProduct.count({
    where: {
      userId: userId,
    }
  });

  const totalPages = Math.ceil(total / limit);

  return {
    data: result,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

const deleteFavoriteProductItemFromDb = async (
  userId: string,
  favoriteProductId: string,
) => {
  const deletedItem = await prisma.favoriteProduct.deleteMany({
    where: {
      productId: favoriteProductId,
      userId: userId,
    },
  });
  if (deletedItem.count === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'favoriteProductId, not deleted',
    );
  }

  return deletedItem;
};

export const favoriteProductService = {
  createFavoriteProductIntoDb,
  getFavoriteProductListFromDb,
  deleteFavoriteProductItemFromDb,
};

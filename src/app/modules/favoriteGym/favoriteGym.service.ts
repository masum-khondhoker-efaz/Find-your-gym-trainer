import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createFavoriteGymIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.favoriteGyms.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteGym not created');
  }
    return result;
};

const getFavoriteGymListFromDb = async (userId: string) => {
  
    const result = await prisma.favoriteGyms.findMany({
      where: {
        userId: userId,
      },
    });
    if (result.length === 0) {
    return { message: 'No favoriteGym found' };
  }
    return result;
};

const getFavoriteGymByIdFromDb = async (userId: string, favoriteGymId: string) => {
  
    const result = await prisma.favoriteGyms.findUnique({ 
    where: {
      id: favoriteGymId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'favoriteGym not found');
  }
    return result;
  };



const updateFavoriteGymIntoDb = async (userId: string, favoriteGymId: string, data: any) => {
  
    const result = await prisma.favoriteGyms.update({
      where:  {
        id: favoriteGymId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteGymId, not updated');
  }
    return result;
  };

const deleteFavoriteGymItemFromDb = async (userId: string, favoriteGymId: string) => {
    const deletedItem = await prisma.favoriteGyms.delete({
      where: {
      id: favoriteGymId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteGymId, not deleted');
  }

    return deletedItem;
  };

export const favoriteGymService = {
createFavoriteGymIntoDb,
getFavoriteGymListFromDb,
getFavoriteGymByIdFromDb,
updateFavoriteGymIntoDb,
deleteFavoriteGymItemFromDb,
};
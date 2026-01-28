import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createSocialIntoDb = async (userId: string, data: any) => {

  // check if social with the same name already exists
  // Check if any social account with the same platform type already exists
  const existingChecks = await Promise.all(
    data.map(async (item: any) => {
      const existingSocial = await prisma.socialAccount.findFirst({
        where: {
          userId: userId,
          platformType: item.platformType,
        },
      });
      return { item, exists: !!existingSocial };
    })
  );

  const duplicates = existingChecks.filter(check => check.exists);
  if (duplicates.length > 0) {
    const platformTypes = duplicates.map(d => d.item.platformType).join(', ');
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Social accounts already exist for: ${platformTypes}. Please remove duplicates and try again.`
    );
  }

  
    const result = await prisma.socialAccount.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'social not created');
  }
    return result;
};

const getSocialListFromDb = async (userId: string) => {
  
    const result = await prisma.socialAccount.findMany();
    if (result.length === 0) {
    return { message: 'No social found' };
  }
    return result;
};

const getSocialByIdFromDb = async (userId: string, socialId: string) => {
  
    const result = await prisma.socialAccount.findUnique({ 
    where: {
      id: socialId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'social not found');
  }
    return result;
  };



const updateSocialIntoDb = async (userId: string, socialId: string, data: any) => {
  
    const result = await prisma.socialAccount.update({
      where:  {
        id: socialId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'socialId, not updated');
  }
    return result;
  };

const deleteSocialItemFromDb = async (userId: string, socialId: string) => {
    const deletedItem = await prisma.socialAccount.delete({
      where: {
      id: socialId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'socialId, not deleted');
  }

    return deletedItem;
  };

export const socialService = {
createSocialIntoDb,
getSocialListFromDb,
getSocialByIdFromDb,
updateSocialIntoDb,
deleteSocialItemFromDb,
};
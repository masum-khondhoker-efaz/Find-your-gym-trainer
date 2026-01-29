import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createSocialIntoDb = async (userId: string, data: any[]) => {
  // 1️⃣ Check duplicates in request (platformType only)
  const platformTypes = data.map(item => item.platformType);
  if (platformTypes.length !== new Set(platformTypes).size) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Duplicate platform types are not allowed in one request.',
    );
  }

  // 2️⃣ Insert (DB will protect uniqueness)
  try {
    const result = await prisma.socialAccount.createMany({
      data: data.map(item => ({
        userId,
        platformType: item.platformType,
        platformUrl: item.platformUrl,
      })),
    });

    if (result.count === 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Social accounts not created');
    }

    return result;
  } catch (error: any) {
    // 3️⃣ Handle unique constraint error
    if (error.code === 'P2002') {
      throw new AppError(
        httpStatus.CONFLICT,
        'One or more social accounts already exist for this user.',
      );
    }
    throw error;
  }
};

const getSocialListFromDb = async (userId: string) => {
  const result = await prisma.socialAccount.findMany({
    where: {
      userId: userId,
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getSocialByIdFromDb = async (userId: string, socialId: string) => {
  const result = await prisma.socialAccount.findUnique({
    where: {
      id: socialId,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'social not found');
  }
  return result;
};

const updateSocialIntoDb = async (
  userId: string,
  socialId: string,
  data: any,
) => {
  // 1️⃣ Check existence & ownership
  const existing = await prisma.socialAccount.findFirst({
    where: {
      id: socialId,
      userId: userId,
      platformType: data.platformType,
    },
  });

  if (!existing) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Social account not found or unauthorized',
    );
  }

  // 2️⃣ Update using unique identifier
  try {
    const result = await prisma.socialAccount.update({
      where: {
        id: socialId, // ✅ unique only
      },
      data: {
        ...data,
      },
    });

    return result;
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new AppError(
        httpStatus.CONFLICT,
        'Social account with this platform already exists',
      );
    }
    throw error;
  }
};

const deleteSocialItemFromDb = async (userId: string, socialId: string) => {
  // 1️⃣ Check existence & ownership
  const existing = await prisma.socialAccount.findFirst({
    where: {
      id: socialId,
      userId: userId,
    },
  });
  
  if (!existing) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Social account not found or unauthorized',
    );
  }

  // 2️⃣ Delete using unique identifier
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

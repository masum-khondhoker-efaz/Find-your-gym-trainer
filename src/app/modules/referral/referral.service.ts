import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createReferralIntoDb = async (userId: string, data: any) => {
  // check if referral code already exists
  const existingReferral = await prisma.referral.findMany({
    where: {
      userId: userId,
      referralCode: {
        not: null as any,
      },
    },
  });
  if (existingReferral.length > 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Referral code already exists');
  }

  const result = await prisma.referral.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'referral not created');
  }
  return result;
};

const getReferralListFromDb = async (userId: string) => {
  const result = await prisma.referral.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getReferralByIdFromDb = async (userId: string, referralId: string) => {
  const result = await prisma.referral.findUnique({
    where: {
      id: referralId,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'referral not found');
  }
  return result;
};

const updateReferralIntoDb = async (
  userId: string,
  referralId: string,
  data: any,
) => {
  // check if referral exists
  const existingReferral = await prisma.referral.findUnique({
    where: {
      id: referralId,
      userId: userId,
    },
  });
  if (!existingReferral) {
    throw new AppError(httpStatus.NOT_FOUND, 'Referral not found');
  }

  const result = await prisma.referral.update({
    where: {
      id: referralId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'referralId, not updated');
  }
  return result;
};

const deleteReferralItemFromDb = async (userId: string, referralId: string) => {
  // check if referral exists
  const existingReferral = await prisma.referral.findUnique({
    where: {
      id: referralId,
      userId: userId,
    },
  });
  if (!existingReferral) {
    throw new AppError(httpStatus.NOT_FOUND, 'Referral not found');
  }
  
  const deletedItem = await prisma.referral.delete({
    where: {
      id: referralId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'referralId, not deleted');
  }

  return deletedItem;
};

export const referralService = {
  createReferralIntoDb,
  getReferralListFromDb,
  getReferralByIdFromDb,
  updateReferralIntoDb,
  deleteReferralItemFromDb,
};

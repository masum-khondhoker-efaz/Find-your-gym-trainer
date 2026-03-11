import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

// NEW: Validate referral code and get discount amount (for preview)
const validateReferralCodeAndGetDiscount = async (userId: string, data: any) => {
  const { referralCode } = data;

  // Check if referral code exists in the database
  const referral = await prisma.referral.findFirst({
    where: {
      referralCode: referralCode,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  if (!referral) {
    throw new AppError(httpStatus.NOT_FOUND, 'Referral code does not exist');
  }

  // Check if user is trying to apply their own referral code
  if (referral.userId === userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You cannot apply your own referral code');
  }

  // Check if user has already applied this referral code
  const existingAppliedReferral = await prisma.appliedReferral.findFirst({
    where: {
      userId: userId,
      referralId: referral.id,
    },
  });

  if (existingAppliedReferral) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You have already applied this referral code');
  }

  // Get the referral reward amount from referralRewardSettings
  const referralRewardSettings = await prisma.referralRewardSettings.findFirst();
  if (!referralRewardSettings) {
    throw new AppError(httpStatus.NOT_FOUND, 'Referral reward settings not found');
  }

  return {
    valid: true,
    referralCode: referral.referralCode,
    discountAmount: referralRewardSettings.rewardAmount,
    referredBy: {
      name: referral.user.fullName,
      email: referral.user.email,
    },
    message: `You will get $${referralRewardSettings.rewardAmount} off your subscription`,
  };
};

// DEPRECATED: This function is no longer used. Referrals are now applied during checkout.
// Keeping for backward compatibility but will be removed in future versions.
const createAppliedReferralIntoDb = async (userId: string, data: any) => {
  const { referralCode } = data;

  // Check if referral code exists in the database
  const referral = await prisma.referral.findFirst({
    where: {
      referralCode: referralCode,
    },
    include: {
      user: true,
    },
  });

  if (!referral) {
    throw new AppError(httpStatus.NOT_FOUND, 'Referral code does not exist');
  }

  // Check if user is trying to apply their own referral code
  if (referral.userId === userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You cannot apply your own referral code');
  }

  // Check if user has already applied this referral code
  const existingAppliedReferral = await prisma.appliedReferral.findFirst({
    where: {
      userId: userId,
      referralId: referral.id,
    },
  });

  if (existingAppliedReferral) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You have already applied this referral code');
  }

  // Create the applied referral
  const result = await prisma.appliedReferral.create({ 
    data: {
      userId: userId,
      referralId: referral.id,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Applied referral not created');
  }

  // find the referral reward amount from referralRewardSettings
    const referralRewardSettings = await prisma.referralRewardSettings.findFirst();
    if (!referralRewardSettings) {
      throw new AppError(httpStatus.NOT_FOUND, 'Referral reward settings not found');
    }

    

  return {
    appliedReferral: result,
    referralRewardAmount: referralRewardSettings.rewardAmount,
  };
};

const getAppliedReferralListFromDb = async (userId: string) => {
  
    const result = await prisma.appliedReferral.findMany();
    if (result.length === 0) {
    return { message: 'No appliedReferral found' };
  }
    return result;
};

const getAppliedReferralByIdFromDb = async (userId: string, appliedReferralId: string) => {
  
    const result = await prisma.appliedReferral.findUnique({ 
    where: {
      id: appliedReferralId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'appliedReferral not found');
  }
    return result;
  };



const updateAppliedReferralIntoDb = async (userId: string, appliedReferralId: string, data: any) => {
  
    const result = await prisma.appliedReferral.update({
      where:  {
        id: appliedReferralId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'appliedReferralId, not updated');
  }
    return result;
  };

const deleteAppliedReferralItemFromDb = async (userId: string, appliedReferralId: string) => {
    const deletedItem = await prisma.appliedReferral.delete({
      where: {
      id: appliedReferralId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'appliedReferralId, not deleted');
  }

    return deletedItem;
  };

export const appliedReferralService = {
validateReferralCodeAndGetDiscount,
createAppliedReferralIntoDb,
getAppliedReferralListFromDb,
getAppliedReferralByIdFromDb,
updateAppliedReferralIntoDb,
deleteAppliedReferralItemFromDb,
};
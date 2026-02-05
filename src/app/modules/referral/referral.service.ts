import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import Stripe from 'stripe';
import config from '../../../config';
// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

const createReferralIntoDb = async (userId: string, data: any) => {
  // check if referral code already exists
  const existingReferral = await prisma.referral.findMany({
    where: {
      referralCode: data.referralCode,
    },
  });
  if (existingReferral.length > 0) {
    const isOwnedByCurrentUser = existingReferral.some(
      ref => ref.userId === userId,
    );
    const isOwnedByOtherUser = existingReferral.some(
      ref => ref.userId !== userId,
    );

    if (isOwnedByCurrentUser) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'You have already created this referral code',
      );
    }
    if (isOwnedByOtherUser) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Referral code already exists',
      );
    }
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

  // calculate the percentage discount based on subscription offer
  // For example, if the offer is $100 and you want to give a 10% discount, the percentage would be 10. You can adjust this logic based on your specific requirements.
  const getRewardAmount = await prisma.referralRewardSettings.findFirst();
  if (!getRewardAmount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Referral reward settings not found',
    );
  }

  // Add discount coupon to the stripe
  const coupon = await stripe.coupons.create({
    name: `Referral Discount for ${data.referralCode}`,
    amount_off: getRewardAmount.rewardAmount, // e.g. $5.00 (amount is in smallest currency unit)
    currency: 'usd', // required when using amount_off
    duration: 'once',
    id: data.referralCode,
  });

  // Update the referral with the stripe coupon ID
  const updatedReferral = await prisma.referral.update({
    where: {
      id: result.id,
    },
    data: {
      stripeCouponId: coupon.id,
    },
  });
  if (!updatedReferral) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'referral stripe coupon ID not updated',
    );
  }

  return result;
};

const getReferralListFromDb = async (userId: string) => {
  const result = await prisma.referral.findMany({
    where: {
      userId: userId,
    },
  });
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
  data: {
    referralCode?: string;
  },
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
  if (existingReferral.referralCode === data.referralCode) {
    return existingReferral; // no changes needed
  }

  // check if updating referralCode to an existing one (only if referralCode is being changed)
  if (
    data.referralCode &&
    data.referralCode !== existingReferral.referralCode
  ) {
    const referralWithSameCode = await prisma.referral.findFirst({
      where: {
        referralCode: data.referralCode,
        id: {
          not: referralId, // exclude current referral
        },
      },
    });

    if (referralWithSameCode) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Referral code already exists',
      );
    }
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

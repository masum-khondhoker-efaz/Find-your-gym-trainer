import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createReferralRewardSettingsIntoDb = async (
  userId: string,
  data: any,
) => {
  // check if referralRewardSettings already exists
  const existingReferralRewardSettings =
    await prisma.referralRewardSettings.findFirst();
  if (existingReferralRewardSettings) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Referral Reward already exists',
    );
  }

  const result = await prisma.referralRewardSettings.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'referralRewardSettings not created',
    );
  }
  return result;
};

const getReferralRewardSettingsListFromDb = async (userId: string) => {
  const result = await prisma.referralRewardSettings.findMany();
  if (result.length === 0) {
    return { message: 'No referralRewardSettings found' };
  }
  return result;
};

const getReferralRewardSettingsByIdFromDb = async (
  userId: string,
  referralRewardSettingsId: string,
) => {
  const result = await prisma.referralRewardSettings.findUnique({
    where: {
      id: referralRewardSettingsId,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'referralRewardSettings not found',
    );
  }
  return result;
};

const updateReferralRewardSettingsIntoDb = async (
  userId: string,
  referralRewardSettingsId: string,
  data: any,
) => {
  const existingReferralRewardSettings =
    await prisma.referralRewardSettings.findUnique({
      where: {
        id: referralRewardSettingsId,
      },
    });
  if (!existingReferralRewardSettings) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'ReferralRewardSettings not found',
    );
  }

  const result = await prisma.referralRewardSettings.update({
    where: {
      id: referralRewardSettingsId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'referralRewardSettingsId, not updated',
    );
  }
  return result;
};

const deleteReferralRewardSettingsItemFromDb = async (
  userId: string,
  referralRewardSettingsId: string,
) => {
  const existingReferralRewardSettings =
    await prisma.referralRewardSettings.findUnique({
      where: {
        id: referralRewardSettingsId,
      },
    });
  if (!existingReferralRewardSettings) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Referral Reward not found',
    );
  }

  const deletedItem = await prisma.referralRewardSettings.delete({
    where: {
      id: referralRewardSettingsId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'referralRewardSettingsId, not deleted',
    );
  }

  return deletedItem;
};

export const referralRewardSettingsService = {
  createReferralRewardSettingsIntoDb,
  getReferralRewardSettingsListFromDb,
  getReferralRewardSettingsByIdFromDb,
  updateReferralRewardSettingsIntoDb,
  deleteReferralRewardSettingsItemFromDb,
};

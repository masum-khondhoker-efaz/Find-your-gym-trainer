import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { referralRewardSettingsService } from './referralRewardSettings.service';

const createReferralRewardSettings = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result =
    await referralRewardSettingsService.createReferralRewardSettingsIntoDb(
      user.id,
      req.body,
    );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'ReferralRewardSettings created successfully',
    data: result,
  });
});

const getReferralRewardSettingsList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result =
    await referralRewardSettingsService.getReferralRewardSettingsListFromDb(
      user.id,
    );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ReferralRewardSettings list retrieved successfully',
    data: result,
  });
});

const getReferralRewardSettingsById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result =
    await referralRewardSettingsService.getReferralRewardSettingsByIdFromDb(
      user.id,
      req.params.id,
    );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ReferralRewardSettings details retrieved successfully',
    data: result,
  });
});

const updateReferralRewardSettings = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result =
    await referralRewardSettingsService.updateReferralRewardSettingsIntoDb(
      user.id,
      req.params.id,
      req.body,
    );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ReferralRewardSettings updated successfully',
    data: result,
  });
});

const deleteReferralRewardSettings = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result =
    await referralRewardSettingsService.deleteReferralRewardSettingsItemFromDb(
      user.id,
      req.params.id,
    );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ReferralRewardSettings deleted successfully',
    data: result,
  });
});

export const referralRewardSettingsController = {
  createReferralRewardSettings,
  getReferralRewardSettingsList,
  getReferralRewardSettingsById,
  updateReferralRewardSettings,
  deleteReferralRewardSettings,
};

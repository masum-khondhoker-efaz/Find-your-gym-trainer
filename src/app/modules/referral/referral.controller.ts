import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { referralService } from './referral.service';

const createReferral = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await referralService.createReferralIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Referral created successfully',
    data: result,
  });
});

const getReferralList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await referralService.getReferralListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referral list retrieved successfully',
    data: result,
  });
});

const getReferralById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await referralService.getReferralByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referral details retrieved successfully',
    data: result,
  });
});

const updateReferral = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await referralService.updateReferralIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referral updated successfully',
    data: result,
  });
});

const deleteReferral = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await referralService.deleteReferralItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referral deleted successfully',
    data: result,
  });
});

export const referralController = {
  createReferral,
  getReferralList,
  getReferralById,
  updateReferral,
  deleteReferral,
};
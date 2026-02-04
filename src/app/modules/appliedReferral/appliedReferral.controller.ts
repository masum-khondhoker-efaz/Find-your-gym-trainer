import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { appliedReferralService } from './appliedReferral.service';

const createAppliedReferral = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await appliedReferralService.createAppliedReferralIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'AppliedReferral created successfully',
    data: result,
  });
});

const getAppliedReferralList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await appliedReferralService.getAppliedReferralListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AppliedReferral list retrieved successfully',
    data: result,
  });
});

const getAppliedReferralById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await appliedReferralService.getAppliedReferralByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AppliedReferral details retrieved successfully',
    data: result,
  });
});

const updateAppliedReferral = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await appliedReferralService.updateAppliedReferralIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AppliedReferral updated successfully',
    data: result,
  });
});

const deleteAppliedReferral = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await appliedReferralService.deleteAppliedReferralItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AppliedReferral deleted successfully',
    data: result,
  });
});

export const appliedReferralController = {
  createAppliedReferral,
  getAppliedReferralList,
  getAppliedReferralById,
  updateAppliedReferral,
  deleteAppliedReferral,
};
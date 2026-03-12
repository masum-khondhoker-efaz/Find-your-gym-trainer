import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { disclaimerService } from './disclaimer.service';

const createDisclaimer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await disclaimerService.createDisclaimerIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Disclaimer created successfully',
    data: result,
  });
});

const getDisclaimerList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await disclaimerService.getDisclaimerListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Disclaimer list retrieved successfully',
    data: result,
  });
});

const getDisclaimerById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await disclaimerService.getDisclaimerByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Disclaimer details retrieved successfully',
    data: result,
  });
});

const updateDisclaimer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await disclaimerService.updateDisclaimerIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Disclaimer updated successfully',
    data: result,
  });
});

const deleteDisclaimer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await disclaimerService.deleteDisclaimerItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Disclaimer deleted successfully',
    data: result,
  });
});

export const disclaimerController = {
  createDisclaimer,
  getDisclaimerList,
  getDisclaimerById,
  updateDisclaimer,
  deleteDisclaimer,
};
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { socialService } from './social.service';

const createSocial = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await socialService.createSocialIntoDb(user.id, req.body.platforms);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Social created successfully',
    data: result,
  });
});

const getSocialList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await socialService.getSocialListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Social list retrieved successfully',
    data: result,
  });
});

const getSocialById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await socialService.getSocialByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Social details retrieved successfully',
    data: result,
  });
});

const updateSocial = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await socialService.updateSocialIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Social updated successfully',
    data: result,
  });
});

const deleteSocial = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await socialService.deleteSocialItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Social deleted successfully',
    data: result,
  });
});

export const socialController = {
  createSocial,
  getSocialList,
  getSocialById,
  updateSocial,
  deleteSocial,
};

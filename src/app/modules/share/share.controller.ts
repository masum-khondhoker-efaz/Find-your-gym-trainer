import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { shareService } from './share.service';

const createShare = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await shareService.createShareIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Post shared successfully',
    data: result,
  });
});

const getShareList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { postId } = req.query;
  const result = await shareService.getShareListFromDb(user.id, postId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Shares retrieved successfully',
    data: result,
  });
});

const getShareById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await shareService.getShareByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Share details retrieved successfully',
    data: result,
  });
});

const deleteShare = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await shareService.deleteShareItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Post unshared successfully',
    data: result,
  });
});

export const shareController = {
  createShare,
  getShareList,
  getShareById,
  deleteShare,
};
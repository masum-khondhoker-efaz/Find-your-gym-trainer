import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { replyService } from './reply.service';

const createReply = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await replyService.createReplyIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Reply created successfully',
    data: result,
  });
});

const getReplyList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await replyService.getReplyListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reply list retrieved successfully',
    data: result,
  });
});

const getReplyById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await replyService.getReplyByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reply details retrieved successfully',
    data: result,
  });
});

const updateReply = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await replyService.updateReplyIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reply updated successfully',
    data: result,
  });
});

const deleteReply = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await replyService.deleteReplyItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reply deleted successfully',
    data: result,
  });
});

export const replyController = {
  createReply,
  getReplyList,
  getReplyById,
  updateReply,
  deleteReply,
};
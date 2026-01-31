import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { commentService } from './comment.service';

const createComment = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await commentService.createCommentIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Comment created successfully',
    data: result,
  });
});

const getCommentList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { postId } = req.query;
  const result = await commentService.getCommentListFromDb(
    user.id,
    postId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comments retrieved successfully',
    data: result,
  });
});

const getCommentById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await commentService.getCommentByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comment details retrieved successfully',
    data: result,
  });
});

const updateComment = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await commentService.updateCommentIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comment updated successfully',
    data: result,
  });
});

const deleteComment = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await commentService.deleteCommentItemFromDb(
    user.id,
    req.params.postId,
    req.params.commentId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comment deleted successfully',
    data: result,
  });
});

export const commentController = {
  createComment,
  getCommentList,
  getCommentById,
  updateComment,
  deleteComment,
};

import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { likeService } from './like.service';

const createLike = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await likeService.createLikeIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Post liked successfully',
    data: result,
  });
});

const getLikeList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { postId } = req.query;
  const result = await likeService.getLikeListFromDb(user.id, postId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Likes retrieved successfully',
    data: result,
  });
});

const getLikeById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await likeService.getLikeByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Like details retrieved successfully',
    data: result,
  });
});

const deleteLike = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await likeService.deleteLikeItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Post disliked successfully',
    data: result,
  });
});

export const likeController = {
  createLike,
  getLikeList,
  getLikeById,
  deleteLike,
};
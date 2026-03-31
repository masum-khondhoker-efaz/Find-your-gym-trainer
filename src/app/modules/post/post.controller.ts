import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { postService } from './post.service';
import { uploadFileToS3 } from '../../utils/multipleFile';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import AppError from '../../errors/AppError';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createPost = catchAsync(async (req, res) => {
  const user = req.user as any;
  const file = req.file;

  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Post image file is required.');
  }

  // Upload to DigitalOcean
  const fileUrl = await uploadFileToS3(file, 'post-media');
  if(!fileUrl){
    throw new AppError(httpStatus.BAD_REQUEST, 'Post image upload failed. Please try again.');
  }

  const result = await postService.createPostIntoDb(user.id, {
    ...req.body,
    image: fileUrl,
  });
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Post created successfully',
    data: result,
  });
});

const getPostList = catchAsync(async (req, res) => {
  const user = req.user as any;

  const result = await postService.getPostListFromDb(
    user.id,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Posts retrieved successfully',
    data: result.data,
    meta: result.pagination,
  });
});

const getAllPostList = catchAsync(async (req, res) => {
  const result = await postService.getAllPostListFromDb(
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All posts retrieved successfully',
    data: result.data,
    meta: result.pagination,
  });
});

const getMyPosts = catchAsync(async (req, res) => {
  const user = req.user as any;

  const result = await postService.getMyPostsFromDb(
    user.id,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My posts retrieved successfully',
    stats: result.stats,
    data: result.data,
    meta: result.pagination,
  });
});

const getAllCommentsByPostId = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await postService.getAllCommentsByPostIdFromDb(
    req.params.id,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comments retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getTrainerPosts = catchAsync(async (req, res) => {
  const user = req.user as any;

  const result = await postService.getTrainerPostsFromDb(
    // user.id,
    req.params.trainerId,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Trainer posts retrieved successfully',
    data: result.data,
    meta: result.pagination,
  });
});

const getAMyPostById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await postService.getAMyPostByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My post details retrieved successfully',
    data: result,
  });
});

const getPostById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await postService.getPostByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Post details retrieved successfully',
    data: result,
  });
});

const updatePost = catchAsync(async (req, res) => {
  const user = req.user as any;
  const file = req.file;

  // if (!file) {
  //   throw new AppError(httpStatus.BAD_REQUEST, 'Post image file is required.');
  // }

  if (!file) {
    const result = await postService.updatePostIntoDb(user.id, req.params.id, {
      ...req.body,
    });
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Post updated successfully',
      data: result,
    });
    return;
  }

  // Delete previous image from s3 bucket Spaces
  const previousImageUrl = await postService.getAMyPostByIdFromDb(
    user.id,
    req.params.id,
  );
  if (previousImageUrl && previousImageUrl.image) {
    await deleteFileFromSpace(previousImageUrl.image);
  }
  // Upload to DigitalOcean
  const fileUrl = await uploadFileToS3(file!, 'post-media');
  const result = await postService.updatePostIntoDb(user.id, req.params.id, {
    ...req.body,
    image: fileUrl,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Post updated successfully',
    data: result,
  });
});

const deletePost = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await postService.deletePostItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Post deleted successfully',
    data: result,
  });
});

export const postController = {
  createPost,
  getPostList,
  getAllPostList,
  getAllCommentsByPostId,
  getMyPosts,
  getTrainerPosts,
  getAMyPostById,
  getPostById,
  updatePost,
  deletePost,
};

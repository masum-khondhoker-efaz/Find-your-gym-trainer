import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createCommentIntoDb = async (userId: string, data: any) => {
  const { postId, text } = data;

  // Verify post exists
  const post = await prisma.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
  }

  const result = await prisma.comment.create({
    data: {
      postId,
      userId,
      text,
    },
    include: {
      user: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Comment not created');
  }

  // Increment post commentCount
  await prisma.post.update({
    where: { id: postId },
    data: { commentCount: { increment: 1 } },
  });

  return result;
};

const getCommentListFromDb = async (userId: string, postId?: string) => {
  const whereClause: any = {};

  if (postId) {
    whereClause.postId = postId;
  }

  const result = await prisma.comment.findMany({
    where: whereClause,
    include: {
      user: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (result.length === 0) {
    return { message: 'No comments found' };
  }

  return result;
};

const getCommentByIdFromDb = async (userId: string, commentId: string) => {
  const result = await prisma.comment.findUnique({
    where: {
      id: commentId,
    },
    include: {
      user: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  return result;
};

const updateCommentIntoDb = async (userId: string, commentId: string, data: any) => {
  const { text } = data;

  const comment = await prisma.comment.findUnique({
    where: {
      id: commentId,
    },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Verify ownership
  if (comment.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Unauthorized');
  }

  const result = await prisma.comment.update({
    where: {
      id: commentId,
    },
    data: {
      text,
    },
    include: {
      user: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Comment not updated');
  }

  return result;
};

const deleteCommentItemFromDb = async (userId: string, commentId: string) => {
  const comment = await prisma.comment.findUnique({
    where: {
      id: commentId,
    },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Verify ownership
  if (comment.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Unauthorized');
  }

  const deletedItem = await prisma.comment.delete({
    where: {
      id: commentId,
    },
  });

  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Comment not deleted');
  }

  // Decrement post commentCount
  await prisma.post.update({
    where: { id: comment.postId },
    data: { commentCount: { decrement: 1 } },
  });

  return deletedItem;
};

export const commentService = {
  createCommentIntoDb,
  getCommentListFromDb,
  getCommentByIdFromDb,
  updateCommentIntoDb,
  deleteCommentItemFromDb,
};
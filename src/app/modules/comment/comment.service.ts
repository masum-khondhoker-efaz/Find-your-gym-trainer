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

  // Check if user has any engagement on this post
  const userLikes = await prisma.like.findFirst({
    where: { postId, userId },
  });

  const userComments = await prisma.comment.findFirst({
    where: { postId, userId },
  });

  const userShares = await prisma.share.findFirst({
    where: { postId, userId },
  });

  const isFirstEngagement = !userLikes && !userComments && !userShares;

  const result = await prisma.comment.create({
    data: {
      postId,
      userId,
      text,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          role: true,
        },
      },
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Comment not created');
  }

  // Weight for comment = 2
  const commentWeight = 2;

  // Increment post metrics
  await prisma.post.update({
    where: { id: postId },
    data: {
      commentCount: { increment: 1 },
      impressionCount: { increment: 1 },
      engagementCount: { increment: commentWeight },
      reachCount: isFirstEngagement ? { increment: 1 } : undefined,
    },
  });

  // Track impression (one per user per post per day)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await prisma.postImpression.upsert({
    where: {
      postId_userId_date: {
        postId,
        userId,
        date: today,
      },
    },
    create: {
      postId,
      userId,
      date: today,
    },
    update: {}, // No update needed, just ensure it exists
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

const deleteCommentItemFromDb = async (userId: string, postId: string, commentId: string) => {
  const comment = await prisma.comment.findUnique({
    where: {
      id: commentId,
      postId: postId,
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
      postId: postId,
    },
  });

  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Comment not deleted');
  }

  // Check if user has any remaining engagement on this post
  const userLikes = await prisma.like.findFirst({
    where: { postId: postId, userId },
  });

  const userShares = await prisma.share.findFirst({
    where: { postId: postId, userId },
  });

  const hasRemainingEngagement = !!userLikes || !!userShares;

  // Weight for comment = 2
  const commentWeight = 2;

  // Decrement post metrics
  await prisma.post.update({
    where: { id: postId },
    data: {
      commentCount: { decrement: 1 },
      impressionCount: { decrement: 1 },
      engagementCount: { decrement: commentWeight },
      reachCount: !hasRemainingEngagement ? { decrement: 1 } : undefined,
    },
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
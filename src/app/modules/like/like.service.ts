import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createLikeIntoDb = async (userId: string, data: any) => {
  const { postId } = data;

  // Verify post exists
  const post = await prisma.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
  }

  // Check if already liked
  const existingLike = await prisma.like.findUnique({
    where: {
      postId_userId: {
        postId,
        userId,
      },
    },
  });

  // If already liked, toggle it off (unlike)
  if (existingLike) {
    await prisma.like.delete({
      where: {
        id: existingLike.id,
      },
    });

    // Check if user has any remaining engagement on this post
    const userComments = await prisma.comment.findFirst({
      where: { postId, userId },
    });

    const userShares = await prisma.share.findFirst({
      where: { postId, userId },
    });

    const hasRemainingEngagement = !!userComments || !!userShares;

    // Weight for like = 1
    const likeWeight = 1;

    // Decrement post metrics
    await prisma.post.update({
      where: { id: postId },
      data: {
        likeCount: { decrement: 1 },
        impressionCount: { decrement: 1 },
        engagementCount: { decrement: likeWeight },
        reachCount: !hasRemainingEngagement ? { decrement: 1 } : undefined,
      },
    });

    return { message: 'Post unliked', liked: false };
  }

  // If not liked, create the like
  const userComments = await prisma.comment.findFirst({
    where: { postId, userId },
  });

  const userShares = await prisma.share.findFirst({
    where: { postId, userId },
  });

  const isFirstEngagement = !userComments && !userShares;

  const result = await prisma.like.create({
    data: {
      postId,
      userId,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Like not created');
  }

  // Weight for like = 1
  const likeWeight = 1;

  // Increment post metrics
  await prisma.post.update({
    where: { id: postId },
    data: {
      likeCount: { increment: 1 },
      impressionCount: { increment: 1 },
      engagementCount: { increment: likeWeight },
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

  return { ...result, liked: true };
};

const getLikeListFromDb = async (userId: string, postId?: string) => {
  const whereClause: any = {};

  if (postId) {
    whereClause.postId = postId;
  } else {
    whereClause.userId = userId;
  }

  const result = await prisma.like.findMany({
    where: whereClause,
    include: {
      user: true,
      post: true,
    },
  });

  if (result.length === 0) {
    return { message: 'No likes found' };
  }

  return result;
};

const getLikeByIdFromDb = async (userId: string, likeId: string) => {
  const result = await prisma.like.findUnique({
    where: {
      id: likeId,
    },
    include: {
      user: true,
      post: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Like not found');
  }

  // Verify ownership
  if (result.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Unauthorized');
  }

  return result;
};

const deleteLikeItemFromDb = async (userId: string, likeId: string) => {
  const like = await prisma.like.findUnique({
    where: {
      id: likeId,
    },
  });

  if (!like) {
    throw new AppError(httpStatus.NOT_FOUND, 'Like not found');
  }

  // Verify ownership
  if (like.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Unauthorized');
  }

  const deletedItem = await prisma.like.delete({
    where: {
      id: likeId,
    },
  });

  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Like not deleted');
  }

  // Check if user has any remaining engagement on this post
  const userComments = await prisma.comment.findFirst({
    where: { postId: like.postId, userId },
  });

  const userShares = await prisma.share.findFirst({
    where: { postId: like.postId, userId },
  });

  const hasRemainingEngagement = !!userComments || !!userShares;

  // Weight for like = 1
  const likeWeight = 1;

  // Decrement post metrics
  await prisma.post.update({
    where: { id: like.postId },
    data: {
      likeCount: { decrement: 1 },
      impressionCount: { decrement: 1 },
      engagementCount: { decrement: likeWeight },
      reachCount: !hasRemainingEngagement ? { decrement: 1 } : undefined,
    },
  });

  return deletedItem;
};

export const likeService = {
  createLikeIntoDb,
  getLikeListFromDb,
  getLikeByIdFromDb,
  deleteLikeItemFromDb,
};
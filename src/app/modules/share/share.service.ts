import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createShareIntoDb = async (userId: string, data: any) => {
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

  const result = await prisma.share.create({
    data: {
      postId,
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
        },
      },
      post: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Post not shared');
  }

  // Weight for share = 5
  const shareWeight = 5;

  // Increment post metrics
  await prisma.post.update({
    where: { id: postId },
    data: {
      shareCount: { increment: 1 },
      impressionCount: { increment: 1 },
      engagementCount: { increment: shareWeight },
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

const getShareListFromDb = async (userId: string, postId?: string) => {
  const whereClause: any = {};

  if (postId) {
    whereClause.postId = postId;
  } else {
    whereClause.userId = userId;
  }

  const result = await prisma.share.findMany({
    where: whereClause,
    include: {
      user: true,
      post: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (result.length === 0) {
    return { message: 'No shares found' };
  }

  return result;
};

const getShareByIdFromDb = async (userId: string, shareId: string) => {
  const result = await prisma.share.findUnique({
    where: {
      id: shareId,
    },
    include: {
      user: true,
      post: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Share not found');
  }

  return result;
};

const deleteShareItemFromDb = async (
  userId: string,
  postId: string,
  shareId: string,
) => {
  const share = await prisma.share.findUnique({
    where: {
      id: shareId,
      postId: postId,
      userId: userId,
    },
  });

  if (!share) {
    throw new AppError(httpStatus.NOT_FOUND, 'Share not found');
  }

  // Verify ownership
  if (share.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Unauthorized');
  }

  const deletedItem = await prisma.share.delete({
    where: {
      id: shareId,
      postId: postId,
      userId: userId,
    },
  });

  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Share not deleted');
  }

  // Check if user has any remaining engagement on this post
  const userLikes = await prisma.like.findFirst({
    where: { postId: postId, userId },
  });

  const userComments = await prisma.comment.findFirst({
    where: { postId: postId, userId },
  });

  const hasRemainingEngagement = !!userLikes || !!userComments;

  // Weight for share = 5
  const shareWeight = 5;

  // Decrement post metrics
  await prisma.post.update({
    where: { id: share.postId },
    data: {
      shareCount: { decrement: 1 },
      impressionCount: { decrement: 1 },
      engagementCount: { decrement: shareWeight },
      reachCount: !hasRemainingEngagement ? { decrement: 1 } : undefined,
    },
  });

  return deletedItem;
};

export const shareService = {
  createShareIntoDb,
  getShareListFromDb,
  getShareByIdFromDb,
  deleteShareItemFromDb,
};

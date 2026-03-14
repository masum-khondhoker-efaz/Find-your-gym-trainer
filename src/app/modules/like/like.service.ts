import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { notificationService } from '../notification/notification.service';

const createLikeIntoDb = async (userId: string, data: any) => {
  const { postId } = data;

  return await prisma.$transaction(async (tx) => {
    // 1️⃣ Verify post exists
    const post = await tx.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!post) {
      throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
    }

    // 2️⃣ Check existing like
    const existingLike = await tx.like.findUnique({
      where: {
        postId_userId: { postId, userId },
      },
    });

    // 3️⃣ Check other engagements once
    const [userComment, userShare] = await Promise.all([
      tx.comment.findFirst({ where: { postId, userId }, select: { id: true } }),
      tx.share.findFirst({ where: { postId, userId }, select: { id: true } }),
    ]);

    const hasOtherEngagement = !!userComment || !!userShare;
    const likeWeight = 1;

    //  UNLIKE FLOW
    if (existingLike) {
      await tx.like.delete({
        where: { id: existingLike.id },
      });

      await tx.post.update({
        where: { id: postId },
        data: {
          likeCount: { decrement: 1 },
          impressionCount: { decrement: 1 },
          engagementCount: { decrement: likeWeight },
          ...(hasOtherEngagement ? {} : { reachCount: { decrement: 1 } }),
        },
      });

      return { message: 'Post unliked', liked: false };
    }

    //  LIKE FLOW
    const newLike = await tx.like.create({
      data: { postId, userId },
    });

    const isFirstEngagement = !hasOtherEngagement;

    await tx.post.update({
      where: { id: postId },
      data: {
        likeCount: { increment: 1 },
        impressionCount: { increment: 1 },
        engagementCount: { increment: likeWeight },
        ...(isFirstEngagement ? { reachCount: { increment: 1 } } : {}),
      },
    });

    // Track impression (1 per day)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await tx.postImpression.upsert({
      where: {
        postId_userId_date: {
          postId,
          userId,
          date: today,
        },
      },
      create: { postId, userId, date: today },
      update: {},
    });

    if (post.userId !== userId) {
      const actor = await tx.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });

      await notificationService.sendNotification(
        'New Like on Your Post',
        `${actor?.fullName || 'Someone'} liked your post.`,
        post.userId,
      );
    }

    return { ...newLike, liked: true };
  });
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
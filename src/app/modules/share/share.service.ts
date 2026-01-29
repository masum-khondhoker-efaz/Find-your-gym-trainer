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

  const result = await prisma.share.create({
    data: {
      postId,
      userId,
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
    throw new AppError(httpStatus.BAD_REQUEST, 'Post not shared');
  }

  // Increment post shareCount
  await prisma.post.update({
    where: { id: postId },
    data: { shareCount: { increment: 1 } },
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

const deleteShareItemFromDb = async (userId: string, shareId: string) => {
  const share = await prisma.share.findUnique({
    where: {
      id: shareId,
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
    },
  });

  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Share not deleted');
  }

  // Decrement post shareCount
  await prisma.post.update({
    where: { id: share.postId },
    data: { shareCount: { decrement: 1 } },
  });

  return deletedItem;
};

export const shareService = {
  createShareIntoDb,
  getShareListFromDb,
  getShareByIdFromDb,
  deleteShareItemFromDb,
};
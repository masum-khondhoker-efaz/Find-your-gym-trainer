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

  if (existingLike) {
    throw new AppError(httpStatus.CONFLICT, 'Post already liked');
  }

  const result = await prisma.like.create({
    data: {
      postId,
      userId,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Like not created');
  }

  // Increment post likeCount
  await prisma.post.update({
    where: { id: postId },
    data: { likeCount: { increment: 1 } },
  });

  return result;
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

  // Decrement post likeCount
  await prisma.post.update({
    where: { id: like.postId },
    data: { likeCount: { decrement: 1 } },
  });

  return deletedItem;
};

export const likeService = {
  createLikeIntoDb,
  getLikeListFromDb,
  getLikeByIdFromDb,
  deleteLikeItemFromDb,
};
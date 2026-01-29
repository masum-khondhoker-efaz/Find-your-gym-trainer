import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createPostIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.post.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'post not created');
  }
    return result;
};

const getPostListFromDb = async (userId: string, limit: number = 10, offset: number = 0) => {
  
  const result = await prisma.post.findMany({
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          bio: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
          shares: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc', // Newest posts first
    },
    take: limit,
    skip: offset,
  });

  if (result.length === 0) {
    return { message: 'No posts found', data: [] };
  }

  // Get total count for pagination
  const total = await prisma.post.count();

  return {
    data: result,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
};

const getPostByIdFromDb = async (userId: string, postId: string) => {
  
    const result = await prisma.post.findUnique({ 
    where: {
      id: postId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'post not found');
  }
    return result;
  };



const updatePostIntoDb = async (userId: string, postId: string, data: any) => {
  // Verify post belongs to user
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      userId: userId,
    },
  });
  
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, 'Post not found or unauthorized');
  }

  const result = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      ...data,
    },
  });
  
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Post not updated');
  }
  
  return result;
};

const deletePostItemFromDb = async (userId: string, postId: string) => {
  // Verify post belongs to user
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      userId: userId,
    },
  });
  
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, 'Post not found or unauthorized');
  }

  const deletedItem = await prisma.post.delete({
    where: {
      id: postId,
    },
  });
  
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Post not deleted');
  }

  return deletedItem;
};

export const postService = {
createPostIntoDb,
getPostListFromDb,
getPostByIdFromDb,
updatePostIntoDb,
deletePostItemFromDb,
};
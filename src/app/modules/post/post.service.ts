import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { page } from 'pdfkit';
import { deleteFileFromSpace } from '../../utils/deleteImage';

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

const getPostListFromDb = async (
  // userId: string,
  limit: number = 10,
  offset: number = 0,
) => {
  const result = await prisma.post.findMany({
    where: {
      isPublished: true,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          // bio: true,
        },
      },
      shares: {
        select: {
          userId: true,
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
  const total = await prisma.post.count({
    where: {
      isPublished: true,
    },
  });

  return {
    data: result.map(post => {
      const { shares, ...postWithoutShares } = post;

      const isShared = shares.length > 0;

      return {
        ...postWithoutShares,
        isShared,
        ...(isShared && {
          sharedBy: shares.map(share => ({
            id: share.userId,
            fullName: share.user.fullName,
            email: share.user.email,
            image: share.user.image,
          })),
        }),
      };
    }),
    pagination: {
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: offset + limit < total,
      hasPrevPage: offset > 0,
    },
  };
};

const getMyPostsFromDb = async (
  userId: string,
  limit: number = 10,
  offset: number = 0,
) => {
  // Fetch current user information
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      image: true,
    },
  });

  const result = await prisma.post.findMany({
    where: {
      isPublished: true,
      OR: [
        { userId: userId },
        {
          shares: {
            some: {
              userId: userId,
            },
          },
        },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          // bio: true,
        },
      },
      shares: {
        select: {
          userId: true,
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
  const total = await prisma.post.count({
    where: {
      isPublished: true,
      OR: [
        { userId: userId },
        {
          shares: {
            some: {
              userId: userId,
            },
          },
        },
      ],
    },
  });

  return {
    data: result.map(post => {
      const { shares, ...postWithoutShares } = post;
      const isShared = shares.some(share => share.userId === userId);

      return {
        ...postWithoutShares,
        // originalPoster: {
        //   isOwner: post.userId === userId,
        //   id: post.user.id,
        //   fullName: post.user.fullName,
        //   email: post.user.email,
        //   image: post.user.image,
        // },
        isShared,
        // If shared, include the current user's info as the sharer
        ...(isShared && {
          sharedBy: {
            id: userId,
            // You'll need to fetch current user's info
            // or include it in the function parameter
            fullName: currentUser!.fullName,
            email: currentUser!.email,
            image: currentUser!.image,
          },
        }),
      };
    }),
    pagination: {
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: offset + limit < total,
      hasPrevPage: offset > 0,
    },
  };
};

const getTrainerPostsFromDb = async (
  // userId: string,
  trainerId: string,
  limit: number = 10,
  offset: number = 0,
) => {
  const result = await prisma.post.findMany({
    where: {
      userId: trainerId,
      isPublished: true,
      user: {
        role: UserRoleEnum.TRAINER,
      },
    },
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
  const total = await prisma.post.count({
    where: {
      user: {
        role: UserRoleEnum.TRAINER,
      },
      isPublished: true,
    },
  });

  return {
    data: result,
    pagination: {
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: offset + limit < total,
      hasPrevPage: offset > 0,
    },
  };
};

const getAMyPostByIdFromDb = async (userId: string, postId: string) => {
  const result = await prisma.post.findFirst({
    where: {
      id: postId,
      userId: userId,
      isPublished: true,
    },
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
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'post not found');
  }
  return result;
};

const getPostByIdFromDb = async (userId: string, postId: string) => {
  const result = await prisma.post.findUnique({
    where: {
      id: postId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'post not found');
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
  // Delete post image from DigitalOcean Spaces
  if (deletedItem.image) {
    await deleteFileFromSpace(deletedItem.image);
  }

  return deletedItem;
};

const getAllPostsImageUrlsFromDb = async () => {
  const result = await prisma.post.findMany({
    where: {
      image: {
        not: null,
      },
    },
    select: {
      id: true,
      image: true,
    },
  });
  return result;
};

export const postService = {
  createPostIntoDb,
  getPostListFromDb,
  getMyPostsFromDb,
  getAMyPostByIdFromDb,
  getTrainerPostsFromDb,
  getPostByIdFromDb,
  updatePostIntoDb,
  deletePostItemFromDb,
  getAllPostsImageUrlsFromDb,
};

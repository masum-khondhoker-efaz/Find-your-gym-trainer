import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { page } from 'pdfkit';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { notificationService } from '../notification/notification.service';

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

  const [postOwner, admins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    }),
    prisma.user.findMany({
      where: {
        role: { in: [UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN] },
        status: UserStatus.ACTIVE,
      },
      select: { id: true },
    }),
  ]);

  await notificationService.sendNotification(
    'Post Published',
    'Your post has been published successfully.',
    userId,
  );

  if (admins.length) {
    await Promise.all(
      admins.map(admin =>
        notificationService.sendNotification(
          'New Post Created',
          `${postOwner?.fullName || 'A user'} created a new post.`,
          admin.id,
        ),
      ),
    );
  }

  return result;
};

const getPostListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const {
    limit: rawLimit = 10,
    offset: rawOffset = 0,
    searchTerm,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    startDate,
    endDate,
  } = options;

  const limit = Number(rawLimit);
  const offset = Number(rawOffset);

  // Handle favorite trainers filter
  const favoriteTrainerIds: string[] = [];
  if (options.postType === 'my_favorite_trainers') {
    const favoriteTrainers = await prisma.favoriteTrainer.findMany({
      where: { userId },
      select: { trainerId: true },
    });
    favoriteTrainerIds.push(...favoriteTrainers.map(ft => ft.trainerId));
  }

  // Build where clause
  const whereClause: any = {
    isPublished: true,
    AND: [
      // Post type filter
      ...(options.postType === 'all_trainers'
        ? [{ user: { role: UserRoleEnum.TRAINER } }]
        : options.postType === 'my_favorite_trainers'
          ? [
              {
                userId: { in: favoriteTrainerIds },
                user: { role: UserRoleEnum.TRAINER },
              },
            ]
          : []),

      // Search term filter
      ...(searchTerm
        ? [
            {
              OR: [
                { content: { contains: searchTerm, mode: 'insensitive' } },
                {
                  user: {
                    fullName: { contains: searchTerm, mode: 'insensitive' },
                  },
                },
              ],
            },
          ]
        : []),

      // Date range filter
      ...(startDate || endDate
        ? [
            {
              createdAt: {
                ...(startDate && { gte: new Date(startDate) }),
                ...(endDate && { lte: new Date(endDate) }),
              },
            },
          ]
        : []),
    ],
  };

  const result = await prisma.post.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
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
      likes: {
        where: { userId },
        select: { userId: true },
      },
      comments: {
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          text: true,
          createdAt: true,
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
      [sortBy]: sortOrder,
    },
    take: limit,
    skip: offset,
  });

  if (result.length === 0) {
    return { message: 'No posts found', data: [] };
  }

  // Get total count for pagination
  const total = await prisma.post.count({ where: whereClause });

  return {
    data: result.map(post => {
      const { shares, likes, comments, ...postWithoutShares } = post;
      const isShared = shares.some(share => share.userId === userId);
      const isLikedByMe = likes.length > 0;
      const myLatestComment = comments.length > 0 ? comments[0] : null;

      return {
        ...postWithoutShares,
        isShared,
        isLikedByMe,
        myLatestComment,
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
      page: Math.floor(offset / limit) + 1,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: offset + limit < total,
      hasPrevPage: offset > 0,
    },
  };
};

const getAllPostListFromDb = async (options: ISearchAndFilterOptions) => {
  const {
    limit: rawLimit = 10,
    offset: rawOffset = 0,
    searchTerm,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    startDate,
    endDate,
  } = options;

  const limit = Number(rawLimit);
  const offset = Number(rawOffset);

  // Build where clause
  const whereClause: any = {
    isPublished: true,
    ...(options.postType === 'all_trainers' && {
      user: { role: UserRoleEnum.TRAINER },
    }),
    AND: [
      // Search term filter
      ...(searchTerm
        ? [
            {
              OR: [
                { content: { contains: searchTerm, mode: 'insensitive' } },
                {
                  user: {
                    fullName: { contains: searchTerm, mode: 'insensitive' },
                  },
                },
              ],
            },
          ]
        : []),

      // Date range filter
      ...(startDate || endDate
        ? [
            {
              createdAt: {
                ...(startDate && { gte: new Date(startDate) }),
                ...(endDate && { lte: new Date(endDate) }),
              },
            },
          ]
        : []),
    ],
  };

  // Block my_favorite_trainers filter for this function
  if (options.postType === 'my_favorite_trainers') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'my_favorite_trainers filter is not allowed for this endpoint',
    );
  }

  const result = await prisma.post.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
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
      [sortBy]: sortOrder,
    },
    take: limit,
    skip: offset,
  });

  if (result.length === 0) {
    return { message: 'No posts found', data: [] };
  }

  // Get total count for pagination
  const total = await prisma.post.count({ where: whereClause });

  return {
    data: result.map(post => {
      const { shares, ...postWithoutShares } = post;
      /**
       * Indicates whether the post has been shared by any user.
       * `true` if there is at least one share, `false` otherwise.
       */
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
  options: ISearchAndFilterOptions,
) => {
  const {
    limit: rawLimit = 10,
    offset: rawOffset = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    searchTerm,
    startDate,
    endDate,
  } = options;
  const limit = Number(rawLimit);
  const offset = Number(rawOffset);

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

  const whereClause: any = {
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
    AND: [
      ...(searchTerm
        ? [
            {
              OR: [{ content: { contains: searchTerm, mode: 'insensitive' } }],
            },
          ]
        : []),
      ...(startDate || endDate
        ? [
            {
              createdAt: {
                ...(startDate && { gte: new Date(startDate) }),
                ...(endDate && { lte: new Date(endDate) }),
              },
            },
          ]
        : []),
    ],
  };

  const result = await prisma.post.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
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
      [sortBy]: sortOrder,
    },
    take: limit,
    skip: offset,
  });

  if (result.length === 0) {
    return { message: 'No posts found', data: [] };
  }

  // Get total count for pagination
  const total = await prisma.post.count({ where: whereClause });

  // Universal stats: Total Posts (owned only)
  const totalPosts = await prisma.post.count({
    where: { userId, isPublished: true },
  });

  // Universal stats: Total Engagement (likes + comments + shares across all user posts)
  const engagementData = await prisma.post.findMany({
    where: { userId, isPublished: true },
    select: {
      _count: {
        select: {
          likes: true,
          comments: true,
          shares: true,
        },
      },
    },
  });

  const totalEngagement = engagementData.reduce(
    (acc, post) =>
      acc + post._count.likes + post._count.comments + post._count.shares,
    0,
  );

  // Universal stats: Avg Reach (total impressions / total posts)
  const totalImpressions = await prisma.postImpression.count({
    where: { post: { userId } },
  });

  const avgReach =
    totalPosts > 0 ? Math.round(totalImpressions / totalPosts) : 0;

  return {
    stats: {
      totalPosts,
      totalEngagement,
      avgReach,
    },
    data: result.map(post => {
      const { shares, ...postWithoutShares } = post;
      const isShared = shares.some(share => share.userId === userId);

      return {
        ...postWithoutShares,
        isShared,
        ...(isShared && {
          sharedBy: {
            id: userId,
            fullName: currentUser!.fullName,
            email: currentUser!.email,
            image: currentUser!.image,
          },
        }),
      };
    }),
    pagination: {
      limit,
      page: Math.floor(offset / limit) + 1,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: offset + limit < total,
      hasPrevPage: offset > 0,
    },
  };
};

const getAllCommentsByPostIdFromDb = async (
  postId: string,
  options: ISearchAndFilterOptions,
) => {
  const { limit: rawLimit = 10, offset: rawOffset = 0 } = options;

  const limit = Number(rawLimit);
  const offset = Number(rawOffset);

  //check if post exists and is published
  const post = await prisma.post.findUnique({
    where: {
      id: postId,
      isPublished: true,
    },
  });
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
  }

  const result = await prisma.comment.findMany({
    where: {
      postId: postId,
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
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  // Get total count for pagination
  const total = await prisma.comment.count({
    where: {
      postId: postId,
    },
  });

  return {
    data: result,
    meta: {
      limit,
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
  options: ISearchAndFilterOptions,
) => {
  const {
    limit: rawLimit = 10,
    offset: rawOffset = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const limit = Number(rawLimit);
  const offset = Number(rawOffset);

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
      [sortBy]: sortOrder,
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
      isPublished: true,
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

  const deletedItem = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      isPublished: false,
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

const getExistingPostListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const {
    limit: rawLimit = 10,
    offset: rawOffset = 0,
    searchTerm,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    startDate,
    endDate,
  } = options;

  const limit = Number(rawLimit);
  const offset = Number(rawOffset);

  // Handle favorite trainers filter
  const favoriteTrainerIds: string[] = [];
  if (options.postType === 'my_favorite_trainers') {
    const favoriteTrainers = await prisma.favoriteTrainer.findMany({
      where: { userId },
      select: { trainerId: true },
    });
    favoriteTrainerIds.push(...favoriteTrainers.map(ft => ft.trainerId));
  }

  // Build where clause
  const whereClause: any = {
    isPublished: true,
    AND: [
      // Post type filter
      ...(options.postType === 'all_trainers'
        ? [{ user: { role: UserRoleEnum.TRAINER } }]
        : options.postType === 'my_favorite_trainers'
          ? [
              {
                userId: { in: favoriteTrainerIds },
                user: { role: UserRoleEnum.TRAINER },
              },
            ]
          : []),

      // Search term filter
      ...(searchTerm
        ? [
            {
              OR: [
                { content: { contains: searchTerm, mode: 'insensitive' } },
                {
                  user: {
                    fullName: { contains: searchTerm, mode: 'insensitive' },
                  },
                },
              ],
            },
          ]
        : []),

      // Date range filter
      ...(startDate || endDate
        ? [
            {
              createdAt: {
                ...(startDate && { gte: new Date(startDate) }),
                ...(endDate && { lte: new Date(endDate) }),
              },
            },
          ]
        : []),
    ],
  };

  const result = await prisma.post.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
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
      likes: {
        where: { userId },
        select: { userId: true },
      },
      comments: {
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          text: true,
          createdAt: true,
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
      [sortBy]: sortOrder,
    },
    take: limit,
    skip: offset,
  });

  if (result.length === 0) {
    return { message: 'No posts found', data: [] };
  }

  // Get total count for pagination
  const total = await prisma.post.count({ where: whereClause });

  return {
    data: result.map(post => {
      const { shares, likes, comments, ...postWithoutShares } = post;
      const isShared = shares.some(share => share.userId === userId);
      const isLikedByMe = likes.length > 0;
      const myLatestComment = comments.length > 0 ? comments[0] : null;

      return {
        ...postWithoutShares,
        isShared,
        isLikedByMe,
        myLatestComment,
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
      page: Math.floor(offset / limit) + 1,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: offset + limit < total,
      hasPrevPage: offset > 0,
    },
  };
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
  getAllPostListFromDb,
  getMyPostsFromDb,
  getAllCommentsByPostIdFromDb,
  getAMyPostByIdFromDb,
  getTrainerPostsFromDb,
  getPostByIdFromDb,
  updatePostIntoDb,
  deletePostItemFromDb,
  getAllPostsImageUrlsFromDb,
};

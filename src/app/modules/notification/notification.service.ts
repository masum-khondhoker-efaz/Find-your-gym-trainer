// Notification.service: Module file for the Notification.service functionality.

// import admin from '../../utils/firebase';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';

const sendNotification = async (
  // deviceToken: string,
  title: string,
  body: string,
  userId: string,
) => {
  if (!title || !body || !userId) {
    throw new Error(
      'Title, body, and user ID are required to send a notification',
    );
  }

  // const message = {
  //   notification: { title, body },
  //   token: deviceToken,
  // };

  // console.log(message);

  try {
    // await admin.messaging().send(message);

    await prisma.notification.create({
      data: {
        title,
        body,
        userId,
      },
    });
    console.log('Notification sent successfully');
    return { title, body, userId };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

const getAllNotifications = async (userId: string, options: ISearchAndFilterOptions = {}) => {
  try {
    const normalizedOptions = {
      ...options,
      page: options.page || 1,
      limit: options.limit || 10,
      sortBy: options.sortBy || 'createdAt',
      sortOrder: options.sortOrder || 'desc',
    };

    const { page, limit, skip, sortBy, sortOrder } =
      calculatePagination(normalizedOptions);

    const andConditions: Prisma.NotificationWhereInput[] = [];

    // Filter by user ID
    andConditions.push({
      userId: userId,
    });

    if (options.searchTerm) {
      andConditions.push({
        OR: [
          {
            title: {
              contains: options.searchTerm,
              mode: 'insensitive',
            },
          },
          {
            body: {
              contains: options.searchTerm,
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    if (options.isRead !== undefined) {
      const parsedIsRead =
        typeof options.isRead === 'string'
          ? options.isRead.toLowerCase() === 'true'
          : Boolean(options.isRead);

      andConditions.push({
        isRead: parsedIsRead,
      });
    }

    const whereConditions: Prisma.NotificationWhereInput = andConditions.length
      ? { AND: andConditions }
      : {};

    const sortableFields = ['createdAt', 'updatedAt', 'title'];
    const orderBy: Prisma.NotificationOrderByWithRelationInput =
      sortableFields.includes(sortBy)
        ? ({
            [sortBy]: sortOrder,
          } as Prisma.NotificationOrderByWithRelationInput)
        : { createdAt: sortOrder };

    const [notifications, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.notification.count({
        where: whereConditions,
      }),
    ]);

    return formatPaginationResponse(notifications, total, page, limit);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

const getNotificationByUserId = async (userId: string) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
    });
    return notifications;
  } catch (error) {
    console.error('Error fetching notifications by user ID:', error);
    throw error;
  }
};

const readNotificationByUserId = async (userId: string) => {
  try {
    const notifications = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, isClicked: true },
    });
    return notifications;
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

const sendNotificationToGroupIntoDb = async (
  userId: string,
  notificationData: {
    title: string;
    body: string;
    users: string[];
  },
) => {
  const { title, body, users } = notificationData;

  const notifications = users.map(async user => {
    const fcmToken = await prisma.user.findUnique({
      where: { id: user },
      select: { fcmToken: true },
    });

    if (fcmToken?.fcmToken) {
      const message = {
        notification: { title, body },
        token: fcmToken.fcmToken,
      };

      //  await admin.messaging().send(message);
    }

    const notifications = await prisma.notification.create({
      data: {
        title,
        body,
        userId: user,
      },
    });
  });

  await Promise.all(notifications);

  return notifications;
};

const readANotificationByUserId = async (
  userId: string,
  notificationId: string,
) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true, isClicked: true },
    });
    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

const deleteNotificationByUserId = async (userId: string) => {
 // check if user has any notifications
  const existingNotifications = await prisma.notification.findMany({
    where: { userId },
  });

  if (existingNotifications.length === 0) {
    throw new Error('No notifications found for the user');
  }

  // delete notifications
  const deletedNotifications = await prisma.notification.deleteMany({
    where: { userId },
  });
  if (deletedNotifications.count === 0) {
    throw new Error('Failed to delete notifications for the user');
  }

  return deletedNotifications;
};

const deleteANotificationByUserId = async (userId: string, notificationId: string) => {
  // check if the notification exists for the user
  const existingNotification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!existingNotification) {
    throw new Error('Notification not found for the user');
  }
  
  // delete the notification
  const deletedNotification = await prisma.notification.delete({
    where: { id: notificationId },
  });
  if (!deletedNotification) {
    throw new Error('Failed to delete the notification for the user');
  }
  
  return deletedNotification;
}

export const notificationService = {
  sendNotification,
  getAllNotifications,
  getNotificationByUserId,
  readNotificationByUserId,
  sendNotificationToGroupIntoDb,
  deleteNotificationByUserId,
  deleteANotificationByUserId,
  readANotificationByUserId,
};

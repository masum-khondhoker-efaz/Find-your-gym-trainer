import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createReplyIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.reply.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'reply not created');
  }
    return result;
};

const getReplyListFromDb = async (userId: string) => {
  
    const result = await prisma.reply.findMany();
    if (result.length === 0) {
    return { message: 'No reply found' };
  }
    return result;
};

const getReplyByIdFromDb = async (userId: string, replyId: string) => {
  
    const result = await prisma.reply.findUnique({ 
    where: {
      id: replyId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'reply not found');
  }
    return result;
  };



const updateReplyIntoDb = async (userId: string, replyId: string, data: any) => {
  
    const result = await prisma.reply.update({
      where:  {
        id: replyId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'replyId, not updated');
  }
    return result;
  };

const deleteReplyItemFromDb = async (userId: string, replyId: string) => {
    const deletedItem = await prisma.reply.delete({
      where: {
      id: replyId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'replyId, not deleted');
  }

    return deletedItem;
  };

export const replyService = {
createReplyIntoDb,
getReplyListFromDb,
getReplyByIdFromDb,
updateReplyIntoDb,
deleteReplyItemFromDb,
};
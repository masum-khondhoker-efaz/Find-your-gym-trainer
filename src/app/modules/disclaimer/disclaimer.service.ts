import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createDisclaimerIntoDb = async (userId: string, data: any) => {

  const existingDisclaimer = await prisma.disclaimer.findFirst(); 
  if (existingDisclaimer) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Disclaimer already exists');
  }
  
    const result = await prisma.disclaimer.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'disclaimer not created');
  }
    return result;
};

const getDisclaimerListFromDb = async () => {
  
    const result = await prisma.disclaimer.findFirst();
    if (!result) {
    return { message: 'Disclaimer not found' };
  }
    return result;
};

const getDisclaimerByIdFromDb = async (disclaimerId: string) => {
  
    const result = await prisma.disclaimer.findUnique({ 
    where: {
      id: disclaimerId,
    }
   });
    if (!result) {
    return { message: 'Disclaimer not found' };
  }
    return result;
  };



const updateDisclaimerIntoDb = async (userId: string, disclaimerId: string, data: any) => {
  
    const result = await prisma.disclaimer.update({
      where:  {
        id: disclaimerId,
        // userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Disclaimer not updated');
  }
    return result;
  };

const deleteDisclaimerItemFromDb = async (userId: string, disclaimerId: string) => {
    const deletedItem = await prisma.disclaimer.delete({
      where: {
      id: disclaimerId,
      // userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Disclaimer not deleted');
  }

    return deletedItem;
  };

export const disclaimerService = {
createDisclaimerIntoDb,
getDisclaimerListFromDb,
getDisclaimerByIdFromDb,
updateDisclaimerIntoDb,
deleteDisclaimerItemFromDb,
};
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createServiceTypesIntoDb = async (userId: string, data: any) => {

  // Check if serviceTypes with the same name already exists
  const existingServiceType = await prisma.serviceTypes.findFirst({
    where: {
      serviceName: data.serviceName,
    },
  });

  if (existingServiceType) {
    return existingServiceType;
  }
  
    const result = await prisma.serviceTypes.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'serviceTypes not created');
  }
    return result;
};

const getServiceTypesListFromDb = async (userId: string) => {
  
    const result = await prisma.serviceTypes.findMany();
    if (result.length === 0) {
    return [];
  }
    return result;
};

const getServiceTypesByIdFromDb = async (userId: string, serviceTypesId: string) => {
  
    const result = await prisma.serviceTypes.findUnique({ 
    where: {
      id: serviceTypesId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'serviceTypes not found');
  }
    return result;
  };



const updateServiceTypesIntoDb = async (userId: string, serviceTypesId: string, data: any) => {
  
  // Check if serviceTypes exists
  const existingServiceType = await prisma.serviceTypes.findUnique({
    where: {
      id: serviceTypesId,
    },
  });

  if (!existingServiceType) {
    throw new AppError(httpStatus.NOT_FOUND, 'serviceTypes not found');
  }

    const result = await prisma.serviceTypes.update({
      where:  {
        id: serviceTypesId,
        // userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'serviceTypesId, not updated');
  }
    return result;
  };

const deleteServiceTypesItemFromDb = async (userId: string, serviceTypesId: string) => {
  // Check if serviceTypes exists
  const existingServiceType = await prisma.serviceTypes.findUnique({
    where: {
      id: serviceTypesId,
    },
  });

  if (!existingServiceType) {
    throw new AppError(httpStatus.NOT_FOUND, 'serviceTypes not found');
  }
  const deletedItem = await prisma.serviceTypes.delete({
      where: {
      id: serviceTypesId,
      // userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'serviceTypesId, not deleted');
  }

    return deletedItem;
  };

export const serviceTypesService = {
createServiceTypesIntoDb,
getServiceTypesListFromDb,
getServiceTypesByIdFromDb,
updateServiceTypesIntoDb,
deleteServiceTypesItemFromDb,
};
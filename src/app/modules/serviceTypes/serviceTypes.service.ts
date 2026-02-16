import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


type CreateServiceTypePayload = {
  serviceName: string;
};

const createServiceTypesIntoDb = async (
  userId: string,
  payload: CreateServiceTypePayload,
) => {
  const serviceName = payload.serviceName.trim();

  if (!serviceName) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Service name is required');
  }

  // 1️⃣ Case-insensitive duplicate check
  const existingServiceType = await prisma.serviceTypes.findFirst({
    where: {
      serviceName: {
        equals: serviceName,
        mode: 'insensitive',
      },
    },
  });

  if (existingServiceType) {
    return existingServiceType;
  }

  try {
    const newServiceType = await prisma.serviceTypes.create({
      data: {
        serviceName,
        userId,
      },
    });

    return newServiceType;
  } catch (error: any) {
    // 2️⃣ Handle race condition (if unique index exists)
    if (error.code === 'P2002') {
      const fallback = await prisma.serviceTypes.findFirst({
        where: {
          serviceName: {
            equals: serviceName,
            mode: 'insensitive',
          },
        },
      });

      if (fallback) return fallback;
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create service type',
    );
  }
};


const getServiceTypesListFromDb = async () => {
  
    const result = await prisma.serviceTypes.findMany();
    if (result.length === 0) {
    return [];
  }
    return result;
};

const getServiceTypesByIdFromDb = async ( serviceTypesId: string) => {
  
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
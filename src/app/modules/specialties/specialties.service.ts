import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createSpecialtiesIntoDb = async (userId: string, data: any) => {
  // Check if specialties with the same name already exists
  const existingSpecialty = await prisma.specialties.findFirst({
    where: {
      specialtyName: data.specialtyName,
    },
  });

  if (existingSpecialty) {
    return existingSpecialty;
  }

  const result = await prisma.specialties.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'specialties not created');
  }
  return result;
};

const getSpecialtiesListFromDb = async (userId: string) => {
  const result = await prisma.specialties.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getSpecialtiesByIdFromDb = async (
  userId: string,
  specialtiesId: string,
) => {
  const result = await prisma.specialties.findUnique({
    where: {
      id: specialtiesId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'specialties not found');
  }
  return result;
};

const updateSpecialtiesIntoDb = async (
  userId: string,
  specialtiesId: string,
  data: any,
) => {

  // Check if specialties exists
  const existingSpecialty = await prisma.specialties.findUnique({
    where: {
      id: specialtiesId,
    },
  });

  if (!existingSpecialty) {
    throw new AppError(httpStatus.NOT_FOUND, 'specialties not found');
  }

  const result = await prisma.specialties.update({
    where: {
      id: specialtiesId,
      // userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'specialtiesId, not updated');
  }
  return result;
};

const deleteSpecialtiesItemFromDb = async (
  userId: string,
  specialtiesId: string,
) => {

  // Check if specialties exists
  const existingSpecialty = await prisma.specialties.findUnique({
    where: {
      id: specialtiesId,
    },
  });

  if (!existingSpecialty) {
    throw new AppError(httpStatus.NOT_FOUND, 'specialties not found');
  }

  const deletedItem = await prisma.specialties.delete({
    where: {
      id: specialtiesId,
      // userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'specialtiesId, not deleted');
  }

  return deletedItem;
};

export const specialtiesService = {
  createSpecialtiesIntoDb,
  getSpecialtiesListFromDb,
  getSpecialtiesByIdFromDb,
  updateSpecialtiesIntoDb,
  deleteSpecialtiesItemFromDb,
};

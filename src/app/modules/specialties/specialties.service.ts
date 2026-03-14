import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  calculatePagination,
  formatPaginationResponse,
  getPaginationQuery,
} from '../../utils/pagination';

type CreateSpecialtyPayload = {
  specialtyName: string;
  specialtyImage?: string;
};

const createSpecialtiesIntoDb = async (
  userId: string,
  payload: CreateSpecialtyPayload,
) => {
  const specialtyName = payload.specialtyName.trim();

  if (!specialtyName) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Specialty name is required');
  }

  // Case-insensitive check
  const existingSpecialty = await prisma.specialties.findFirst({
    where: {
      specialtyName: {
        equals: specialtyName,
        mode: 'insensitive',
      },
    },
  });

  if (existingSpecialty) {
    return existingSpecialty;
  }

  try {
    const newSpecialty = await prisma.specialties.create({
      data: {
        specialtyName,
        specialtyImage: payload.specialtyImage,
        userId,
      },
    });

    return newSpecialty;
  } catch (error) {
    // Handles race condition if two requests hit at same time
    const fallback = await prisma.specialties.findFirst({
      where: {
        specialtyName: {
          equals: specialtyName,
          mode: 'insensitive',
        },
      },
    });

    if (fallback) return fallback;

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create specialty',
    );
  }
};

const getSpecialtiesListFromDb = async (
  options: ISearchAndFilterOptions = {},
) => {
  const normalizedOptions = {
    ...options,
    sortBy: options.sortBy || 'createdAt',
    sortOrder: options.sortOrder || 'desc',
  };

  const { page, limit, skip, sortBy, sortOrder } =
    calculatePagination(normalizedOptions);

  const whereConditions: Record<string, unknown> = {};

  if (options.specialtyName) {
    whereConditions.specialtyName = {
      contains: options.specialtyName,
      mode: 'insensitive',
    };
  }

  if (options.searchTerm) {
    whereConditions.OR = [
      {
        specialtyName: {
          contains: options.searchTerm,
          mode: 'insensitive',
        },
      },
    ];
  }

  const total = await prisma.specialties.count({
    where: whereConditions,
  });

  const result = await prisma.specialties.findMany({
    where: whereConditions,
    ...getPaginationQuery(sortBy, sortOrder),
    skip,
    take: limit,
  });

  return formatPaginationResponse(result, total, page, limit);
};

const getAllSpecialtiesListFromDb = async () => {
  const result = await prisma.specialties.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (result.length === 0) {
    return [];
  }
  return result;
};

const getSpecialtiesByIdFromDb = async (
  // userId: string,
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

type UpdateSpecialtyPayload = {
  specialtyName?: string;
  specialtyImage?: string;
};

const updateSpecialtiesIntoDb = async (
  userId: string,
  specialtiesId: string,
  payload: UpdateSpecialtyPayload,
) => {
  // 1️⃣ Check ownership + existence
  const existingSpecialty = await prisma.specialties.findFirst({
    where: {
      id: specialtiesId,
      userId, // enforce ownership
    },
  });

  if (!existingSpecialty) {
    throw new AppError(httpStatus.NOT_FOUND, 'Specialty not found');
  }

  const updateData: UpdateSpecialtyPayload = {};

  // 2️⃣ Handle specialtyName update safely
  if (payload.specialtyName) {
    const trimmedName = payload.specialtyName.trim();

    // Check duplicate (case-insensitive)
    const duplicate = await prisma.specialties.findFirst({
      where: {
        specialtyName: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        NOT: {
          id: specialtiesId,
        },
      },
    });

    if (duplicate) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Specialty name already exists',
      );
    }

    updateData.specialtyName = trimmedName;
  }


  // 3️⃣ Perform update
  const updatedSpecialty = await prisma.specialties.update({
    where: { id: specialtiesId },
    data: {
      ...updateData,
      specialtyImage: payload.specialtyImage || existingSpecialty.specialtyImage,
    },
  });

  return updatedSpecialty;
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
  getAllSpecialtiesListFromDb,
  getSpecialtiesByIdFromDb,
  updateSpecialtiesIntoDb,
  deleteSpecialtiesItemFromDb,
};

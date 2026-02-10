import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination } from '../../utils/pagination';
import { buildSearchQuery, buildFilterQuery, combineQueries, buildDateRangeQuery } from '../../utils/searchFilter';
import { formatPaginationResponse, getPaginationQuery } from '../../utils/pagination';

const createFoundingTeamIntoDb = async (userId: string, data: any) => {

  //check existing member with same links
  if (data.linkedin || data.instagram || data.twitter) {
    const existingMember = await prisma.foundingTeam.findFirst({
      where: {
        OR: [
          { linkedin: data.linkedin },
          { instagram: data.instagram },
          { twitter: data.twitter },
        ],
      },
    });
    if (existingMember) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Team member with this linkedin/instagram/twitter already exists',
      );
    }
  }

  const result = await prisma.foundingTeam.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Founding team member not created');
  }
  return result;
};

const getFoundingTeamListFromDb = async (options: ISearchAndFilterOptions) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields (using common fields that likely exist)
  const searchFields = [
    'name',
    'linkedin',
    'instagram',
    'twitter',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query (using only basic fields that are likely to exist)
  const filterFields: Record<string, any> = {
    ...(options.memberName && { 
      name: {
        contains: options.memberName,
        mode: 'insensitive' as const,
      }
    }),
    ...(options.linkedin && { 
      linkedin: {
        contains: options.linkedin,
        mode: 'insensitive' as const,
      }
    }),
    ...(options.instagram && { 
      instagram: {
        contains: options.instagram,
        mode: 'insensitive' as const,
      }
    }),
    ...(options.twitter && { 
      twitter: {
        contains: options.twitter,
        mode: 'insensitive' as const,
      }
    }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Date range filtering
  const dateQuery = buildDateRangeQuery({
    startDate: options.startDate,
    endDate: options.endDate,
    dateField: 'createdAt',
  });

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery,
    dateQuery
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.foundingTeam.count({ where: whereQuery });

  // Fetch paginated data
  const foundingTeamMembers = await prisma.foundingTeam.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
  });

  return formatPaginationResponse(foundingTeamMembers, total, page, limit);
};

const getFoundingTeamByIdFromDb = async (
  userId: string,
  foundingTeamId: string,
) => {
  const result = await prisma.foundingTeam.findUnique({
    where: {
      id: foundingTeamId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Founding team member not found');
  }
  return result;
};

const updateFoundingTeamIntoDb = async (
  userId: string,
  foundingTeamId: string,
  data: any,
) => {
  // check existing member with same links
  if (data.linkedin || data.instagram || data.twitter) {
    const existingMember = await prisma.foundingTeam.findFirst({
      where: {
        id: { not: foundingTeamId },
        OR: [
          ...(data.linkedin ? [{ linkedin: data.linkedin }] : []),
          ...(data.instagram ? [{ instagram: data.instagram }] : []),
          ...(data.twitter ? [{ twitter: data.twitter }] : []),
        ],
      },
    });
    if (existingMember) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Team member with this linkedin/instagram/twitter already exists',
      );
    }
  }

  const result = await prisma.foundingTeam.update({
    where: {
      id: foundingTeamId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Founding TeamId, not updated');
  }
  return result;
};

const deleteFoundingTeamItemFromDb = async (
  userId: string,
  foundingTeamId: string,
) => {
  const deletedItem = await prisma.foundingTeam.delete({
    where: {
      id: foundingTeamId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Founding TeamId, not deleted');
  }

  return deletedItem;
};

export const foundingTeamService = {
  createFoundingTeamIntoDb,
  getFoundingTeamListFromDb,
  getFoundingTeamByIdFromDb,
  updateFoundingTeamIntoDb,
  deleteFoundingTeamItemFromDb,
};

import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { ProductStatus } from '@prisma/client';

const createCustomPricingIntoDb = async (userId: string, data: any) => {
  const { productId, customPrice, limit, startDate, endDate, weeks, invoiceFrequency } = data;

  // Verify that the product exists and belongs to the trainer
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      userId: userId,
      isActive: true,
      status: ProductStatus.ACTIVE
    },
  });

  if (!product) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Product not found or you do not have permission to add custom pricing',
    );
  }

  // Validate that custom price is less than regular price
  if (customPrice >= product.price) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Custom price must be less than the regular product price',
    );
  }

  // Validate date range
  if (new Date(endDate) <= new Date(startDate)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'End date must be after start date',
    );
  }

  // Check for overlapping custom pricing in the same time period
  const overlappingPricing = await prisma.customPricing.findFirst({
    where: {
      productId,
      AND: [
        { startDate: { lt: new Date(endDate) } },
        { endDate: { gt: new Date(startDate) } },
      ],
    },
  });

  if (overlappingPricing) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A custom pricing already exists for this product in the specified time period',
    );
  }

  // Create custom pricing
  const customPricing = await prisma.customPricing.create({
    data: {
      userId,
      productId,
      customPrice,
      limit,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      weeks,
      invoiceFrequency,
    },
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          price: true,
          userId: true,
        },
      },
    },
  });

  if (!customPricing) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Custom pricing not created');
  }

  return customPricing;
};

const getCustomPricingsByProductFromDb = async (productId: string, userId?: string) => {
  // If userId provided, verify product ownership
  if (userId) {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        userId: userId,
        isActive: true,
        status: ProductStatus.ACTIVE
      },
    });

    if (!product) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Product not found or you do not have permission',
      );
    }
  }

  const customPricings = await prisma.customPricing.findMany({
    where: {
      productId: productId,
    },
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          price: true,
          userId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return customPricings;
};

const getMyCustomPricingsFromDb = async (
  userId: string,
  productId: string,
  options?: ISearchAndFilterOptions,
) => {
  const limit = Number(options?.limit || 10);
  const offset = options?.page
    ? (Number(options.page) - 1) * limit
    : Number(options?.offset || 0);

  const whereClause: any = {
    productId: productId,
    product: {
      userId: userId,
    },
  };

  // Filter by active/expired
  if (options?.status === 'active') {
    whereClause.endDate = { gte: new Date() };
    whereClause.startDate = { lte: new Date() };
  } else if (options?.status === 'expired') {
    whereClause.endDate = { lt: new Date() };
  } else if (options?.status === 'upcoming') {
    whereClause.startDate = { gt: new Date() };
  }

  const sortBy = options?.sortBy || 'createdAt';
  const sortOrder = options?.sortOrder || 'desc';

  const [result, total] = await Promise.all([
    prisma.customPricing.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            price: true,
            productImage: true,
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: {
        [sortBy]: sortOrder,
      },
    }),
    prisma.customPricing.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const page = Number(options?.page || Math.floor(offset / limit) + 1);

  return {
    data: result,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

const getCustomPricingByIdFromDb = async (userId: string, customPricingId: string) => {
  const customPricing = await prisma.customPricing.findFirst({
    where: {
      id: customPricingId,
      product: {
        userId: userId,
      },
    },
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          price: true,
          description: true,
          productImage: true,
          userId: true,
        },
      },
    },
  });

  if (!customPricing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Custom pricing not found');
  }

  return customPricing;
};

const getActiveCustomPricingForProductFromDb = async (productId: string) => {
  const now = new Date();

  const activeCustomPricing = await prisma.customPricing.findFirst({
    where: {
      productId: productId,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: {
      customPrice: 'asc', // Return the lowest price if multiple are active
    },
  });

  return activeCustomPricing;
};

const updateCustomPricingIntoDb = async (
  userId: string,
  customPricingId: string,
  data: any,
) => {
  // Verify ownership
  const existingCustomPricing = await prisma.customPricing.findFirst({
    where: {
      id: customPricingId,
      product: {
        userId: userId,
      },
    },
    include: {
      product: true,
    },
  });

  if (!existingCustomPricing) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Custom pricing not found or you do not have permission',
    );
  }

  // Validate custom price if updated
  if (data.customPrice && data.customPrice >= existingCustomPricing.product.price) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Custom price must be less than the regular product price',
    );
  }

  // Validate date range if updated
  if (data.startDate && data.endDate) {
    if (new Date(data.endDate) <= new Date(data.startDate)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'End date must be after start date',
      );
    }
  }

  // Convert dates if provided
  if (data.startDate) {
    data.startDate = new Date(data.startDate);
  }
  if (data.endDate) {
    data.endDate = new Date(data.endDate);
  }

  const updatedCustomPricing = await prisma.customPricing.update({
    where: {
      id: customPricingId,
    },
    data: {
      ...data,
    },
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          price: true,
        },
      },
    },
  });

  if (!updatedCustomPricing) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Custom pricing not updated');
  }

  return updatedCustomPricing;
};

const deleteCustomPricingFromDb = async (userId: string, customPricingId: string) => {
  // Verify ownership
  const existingCustomPricing = await prisma.customPricing.findFirst({
    where: {
      id: customPricingId,
      product: {
        userId: userId,
      },
    },
  });

  if (!existingCustomPricing) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Custom pricing not found or you do not have permission',
    );
  }

  const deletedCustomPricing = await prisma.customPricing.delete({
    where: {
      id: customPricingId,
    },
  });

  if (!deletedCustomPricing) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Custom pricing not deleted');
  }

  return deletedCustomPricing;
};

export const customPricingService = {
  createCustomPricingIntoDb,
  getCustomPricingsByProductFromDb,
  getMyCustomPricingsFromDb,
  getCustomPricingByIdFromDb,
  getActiveCustomPricingForProductFromDb,
  updateCustomPricingIntoDb,
  deleteCustomPricingFromDb,
};

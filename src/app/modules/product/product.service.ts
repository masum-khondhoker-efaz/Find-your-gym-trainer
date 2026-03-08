import prisma from '../../utils/prisma';
import { ProductStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createProductIntoDb = async (userId: string, data: any) => {
  const { productName, productImage, productVideo, agreementPdf } = data;

  const cleanupFiles = async () => {
    const files = [productImage, productVideo, agreementPdf].filter(Boolean);
    await Promise.all(files.map(file => deleteFileFromSpace(file)));
  };

  // Check duplicate product
  const existingProduct = await prisma.product.findFirst({
    where: {
      userId,
      productName,
    },
  });

  if (existingProduct) {
    await cleanupFiles();
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Product with the same name already exists',
    );
  }

  const product = await prisma.product.create({
    data: {
      ...data,
      userId,
    },
  });

  if (!product) {
    await cleanupFiles();
    throw new AppError(httpStatus.BAD_REQUEST, 'Product not created');
  }

  return product;
};

const getProductListFromDb = async (
  // userId: string,
  options?: ISearchAndFilterOptions,
) => {
  const limit = Number(options?.limit || 10);
  const offset = options?.page
    ? (Number(options.page) - 1) * limit
    : Number(options?.offset || 0);

  const whereClause: any = {
    isActive: true,
    status: ProductStatus.ACTIVE,
  };

  // Search filter
  if (options?.searchTerm) {
    whereClause.OR = [
      { productName: { contains: options.searchTerm, mode: 'insensitive' } },
      { description: { contains: options.searchTerm, mode: 'insensitive' } },
    ];
  }

  // Product name filter
  if (options?.productName) {
    whereClause.productName = {
      contains: options.productName,
      mode: 'insensitive',
    };
  }

  // Description filter
  if (options?.description) {
    whereClause.description = {
      contains: options.description,
      mode: 'insensitive',
    };
  }

  // Price range filter
  if (
    options?.priceMin !== undefined ||
    options?.priceMax !== undefined ||
    options?.priceRange
  ) {
    whereClause.price = {};
    if (options?.priceMin !== undefined) {
      whereClause.price.gte = Number(options.priceMin);
    }
    if (options?.priceMax !== undefined) {
      whereClause.price.lte = Number(options.priceMax);
    }
  }

  // Invoice frequency filter
  if (options?.invoiceFrequency) {
    whereClause.invoiceFrequency = options.invoiceFrequency;
  }

  // Duration weeks filter
  if (options?.durationWeeks !== undefined) {
    const durationValue = String(options.durationWeeks);
    whereClause.durationWeeks = parseInt(durationValue);
  }

  // Status filter
  if (options?.status) {
    whereClause.status = options.status;
  }

  // Service type filter (via trainer relationship)
  if (options?.serviceName) {
    whereClause.user = {
      trainers: {
        some: {
          trainerServiceTypes: {
            some: {
              serviceType: {
                serviceName: options.serviceName,
              },
            },
          },
        },
      },
    };
  }

  const sortBy = options?.sortBy || 'createdAt';
  const sortOrder = options?.sortOrder || 'desc';

  // Filter by specific trainer ID
  if (options?.trainerId) {
    whereClause.userId = options.trainerId;
  }

  // Trainer name filter
  if (options?.trainerName) {
    whereClause.user = {
      ...whereClause.user,
      fullName: {
        contains: options.trainerName,
        mode: 'insensitive',
      },
    };
  }

  // Filter products only from trainers (users with trainer role)
  if (options?.onlyTrainers === true) {
    whereClause.user = {
      ...whereClause.user,
      trainers: {
        some: {},
      },
    };
  }

  const [result, total] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            image: true,
            // trainers: {
            //   select: {
            //     trainerServiceTypes: {
            //       select: {
            //         serviceType: {
            //           select: {
            //             id: true,
            //             serviceName: true,
            //           },
            //         },
            //       },
            //     },
            //   },
            // },
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: {
        [sortBy]: sortOrder,
      },
    }),
    prisma.product.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const page = Number(options?.page || Math.floor(offset / limit) + 1);

  // Get active custom pricing for each product
  const now = new Date();
  const productIds = result.map(p => p.id);
  const activeCustomPricings = await prisma.customPricing.findMany({
    where: {
      productId: { in: productIds },
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: {
      customPrice: 'asc',
    },
  });

  // Create a map of productId to active custom pricing
  const customPricingMap = new Map();
  activeCustomPricings.forEach(cp => {
    if (!customPricingMap.has(cp.productId)) {
      customPricingMap.set(cp.productId, cp);
    }
  });

  // Flatten the response data
  const flattenedResult = result.map(product => {
    // const trainer = product.user?.trainers?.[0];
    // const serviceTypes = trainer?.trainerServiceTypes?.map(tst => tst.serviceType) || [];

    const { user, ...productWithoutUser } = product;
    const activeCustomPricing = customPricingMap.get(product.id);

    return {
      ...productWithoutUser,
      trainerName: user?.fullName,
      trainerEmail: user?.email,
      trainerImage: user?.image,
      trainerId: user?.id,
      // serviceTypes: serviceTypes,
      // Active custom pricing info
      hasActiveDiscount: !!activeCustomPricing,
      activePrice: activeCustomPricing?.customPrice || product.price,
      originalPrice: product.price,
      discountEndDate: activeCustomPricing?.endDate || null,
      customPricingLimit: activeCustomPricing?.limit || null,
    };
  });

  return {
    data: flattenedResult,
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

const getProductByIdFromDb = async (userId: string, productId: string) => {
  const result = await prisma.product.findUnique({
    where: {
      id: productId,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'product not found');
  }
  return result;
};

const getAProductByPublicFromDb = async (productId: string) => {
  const result = await prisma.product.findUnique({
    where: {
      id: productId,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          trainers: {
            select: {
              trainerServiceTypes: {
                select: {
                  serviceType: {
                    select: {
                      id: true,
                      serviceName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      reviews: {
        select: {
          id: true,
          rating: true,
          comment: true,
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
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'product not found');
  }

  // update product view count
  await prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      views: {
        increment: 1,
      },
    },
  });

  // Get active custom pricing for this product
  const now = new Date();
  const activeCustomPricing = await prisma.customPricing.findFirst({
    where: {
      productId: productId,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: {
      customPrice: 'asc',
    },
  });

  // Flatten the response data
  const { user, ...productWithoutUser } = result;
  return {
    ...productWithoutUser,
    reviews: result.reviews || [],
    trainerName: user?.fullName,
    trainerEmail: user?.email,
    trainerImage: user?.image,
    trainerId: user?.id,
    // serviceTypes: serviceTypes,
    // Active custom pricing info
    hasActiveDiscount: !!activeCustomPricing,
    activePrice: activeCustomPricing?.customPrice || result.price,
    originalPrice: result.price,
    discountEndDate: activeCustomPricing?.endDate || null,
    customPricingLimit: activeCustomPricing?.limit || null,
  };
};

const getMyProductsFromDb = async (
  userId: string,
  options?: ISearchAndFilterOptions,
) => {
  const limit = Number(options?.limit || 10);
  const offset = options?.page
    ? (Number(options.page) - 1) * limit
    : Number(options?.offset || 0);

  const whereClause: any = {
    userId: userId,
    // isActive: true,
  };

  // Search filter
  if (options?.searchTerm) {
    whereClause.OR = [
      { productName: { contains: options.searchTerm, mode: 'insensitive' } },
      { description: { contains: options.description, mode: 'insensitive' } },
    ];
  }

  // Product name filter
  if (options?.productName) {
    whereClause.productName = {
      contains: options.productName,
      mode: 'insensitive',
    };
  }

  // Description filter
  if (options?.description) {
    whereClause.description = {
      contains: options.description,
      mode: 'insensitive',
    };
  }

  // Price range filter
  if (
    options?.priceMin !== undefined ||
    options?.priceMax !== undefined ||
    options?.priceRange
  ) {
    whereClause.price = {};
    if (options?.priceMin !== undefined) {
      whereClause.price.gte = Number(options.priceMin);
    }
    if (options?.priceMax !== undefined) {
      whereClause.price.lte = Number(options.priceMax);
    }
  }

  const sortBy = options?.sortBy || 'createdAt';
  const sortOrder = options?.sortOrder || 'desc';

  const [result, total] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      include: {
        // user: {
        //   select: {
        //     id: true,
        //     fullName: true,
        //     email: true,
        //     image: true,
        //   },
        // },
      },
      take: limit,
      skip: offset,
      orderBy: {
        [sortBy]: sortOrder,
      },
    }),
    prisma.product.count({ where: whereClause }),
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

const updateProductIntoDb = async (
  userId: string,
  productId: string,
  data: any,
) => {
  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      userId,
    },
  });

  if (!existingProduct) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const updatedProduct = await prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      ...data,
    },
  });

  if (!updatedProduct) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Product not updated');
  }

  return updatedProduct;
};

const deleteProductItemFromDb = async (userId: string, productId: string) => {
  // Check if product exists
  const existingProduct = await prisma.product.findUnique({
    where: {
      id: productId,
      userId: userId,
    },
  });

  if (!existingProduct) {
    throw new AppError(httpStatus.NOT_FOUND, 'product not found');
  }

  const deletedItem = await prisma.product.delete({
    where: {
      id: productId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'productId, not deleted');
  }

  // Delete associated files from S3 Spaces
  if (deletedItem.productImage) {
    await deleteFileFromSpace(deletedItem.productImage);
  }
  if (deletedItem.productVideo) {
    await deleteFileFromSpace(deletedItem.productVideo);
  }
  if (deletedItem.agreementPdf) {
    await deleteFileFromSpace(deletedItem.agreementPdf);
  }

  // add to the DeletedProducts table for record-keeping (optional)
  const deletedRecord = await prisma.deletedProduct.create({
    data: {
      productId: deletedItem.id,
      sellerId: deletedItem.userId,
      productName: deletedItem.productName,
      description: deletedItem.description,
      price: deletedItem.price,
      discount: 0, // New product schema doesn't have discount
      productImages: [deletedItem.productImage].filter(Boolean), // Array expected
      deletedAt: new Date(),
    },
  });
  if (!deletedRecord) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to record deleted product',
    );
  }

  return deletedItem;
};

const getAProductFromDb = async (userId: string, productId: string) => {
  const result = await prisma.product.findMany({
    where: {
      id: productId,
      isActive: true,
    },
  });
  return result;
};

export const productService = {
  createProductIntoDb,
  getProductListFromDb,
  getMyProductsFromDb,
  getAProductByPublicFromDb,
  getProductByIdFromDb,
  updateProductIntoDb,
  deleteProductItemFromDb,
  getAProductFromDb,
};

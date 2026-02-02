import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createProductIntoDb = async (userId: string, data: any) => {
  // Check if product with the same name already exists for the user
  const existingProduct = await prisma.product.findFirst({
    where: {
      userId: userId,
      productName: data.productName,
    },
  });

  if (existingProduct) {
    // delete uploaded files from the storage if any
    await deleteFileFromSpace(data.productImage);
    await deleteFileFromSpace(data.productVideo);
    await deleteFileFromSpace(data.pdf);
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Product with the same name already exists',
    );
  }

  const result = await prisma.product.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Product not created');
  }
  return result;
};

const getProductListFromDb = async (
  // userId: string,
  options?: ISearchAndFilterOptions,
) => {
  const limit = options?.limit || 10;
  const offset = options?.page
    ? (options.page - 1) * limit
    : options?.offset || 0;

  const whereClause: any = {
    isActive: true,
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

  // Week filter
  if (options?.week !== undefined) {
    const weekValue = String(options.week);
    whereClause.week = parseInt(weekValue);
  }

  const sortBy = options?.sortBy || 'createdAt';
  const sortOrder = options?.sortOrder || 'desc';

  // Trainer name filter
  if (options?.trainerName) {
    whereClause.user = {
      ...whereClause.user,
      trainers: {
        some: {
          ...whereClause.user?.trainers?.some,
          user: {
            fullName: {
              contains: options.trainerName,
              mode: 'insensitive',
            },
          },
        },
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
  const page = options?.page || Math.floor(offset / limit) + 1;

  // Flatten the response data
  const flattenedResult = result.map(product => {
    // const trainer = product.user?.trainers?.[0];
    // const serviceTypes = trainer?.trainerServiceTypes?.map(tst => tst.serviceType) || [];
    
    const { user, ...productWithoutUser } = product;
    return {
      ...productWithoutUser,
      trainerName: user?.fullName,
      trainerEmail: user?.email,
      trainerImage: user?.image,
      trainerId: user?.id,
      // serviceTypes: serviceTypes,
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
      }
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'product not found');
  }

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
  };
}

const getMyProductsFromDb = async (
  userId: string,
  options?: ISearchAndFilterOptions,
) => {
  const limit = options?.limit || 10;
  const offset = options?.page
    ? (options.page - 1) * limit
    : options?.offset || 0;

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
  const page = options?.page || Math.floor(offset / limit) + 1;

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
  const result = await prisma.product.update({
    where: {
      id: productId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'productId, not updated');
  }
  return result;
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
  if (deletedItem.pdf) {
    await deleteFileFromSpace(deletedItem.pdf);
  }

  // add to the DeletedProducts table for record-keeping (optional)
  const deletedRecord = await prisma.deletedProduct.create({
    data: {
      productId: deletedItem.id,
      sellerId: deletedItem.userId,
      productName: deletedItem.productName,
      description: deletedItem.description,
      price: deletedItem.price,
      discount: deletedItem.discount,
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

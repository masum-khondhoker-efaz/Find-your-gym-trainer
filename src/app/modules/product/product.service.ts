import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createProductIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.product.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'product not created');
  }
    return result;
};

const getProductListFromDb = async (userId: string) => {
  
    const result = await prisma.product.findMany();
    if (result.length === 0) {
    return { message: 'No product found' };
  }
    return result;
};

const getProductByIdFromDb = async (userId: string, productId: string) => {
  
    const result = await prisma.product.findUnique({ 
    where: {
      id: productId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'product not found');
  }
    return result;
  };



const updateProductIntoDb = async (userId: string, productId: string, data: any) => {
  
    const result = await prisma.product.update({
      where:  {
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
    const deletedItem = await prisma.product.delete({
      where: {
      id: productId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'productId, not deleted');
  }

    return deletedItem;
  };

export const productService = {
createProductIntoDb,
getProductListFromDb,
getProductByIdFromDb,
updateProductIntoDb,
deleteProductItemFromDb,
};
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { productService } from './product.service';
import { uploadFileToS3 } from '../../utils/multipleFile';
import AppError from '../../errors/AppError';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { boolean } from 'zod';

const createProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const body = req.body;

  // Handle file uploads
  const allFiles = (req.files as Express.Multer.File[]) || [];

  // check if productImage, productVideo or agreementPdf is included in the request
  if (!allFiles.some((file) => file.fieldname === 'productImage')) {
    throw new AppError(httpStatus.BAD_REQUEST, 'productImage is required');
  }
  if (!allFiles.some((file) => file.fieldname === 'productVideo')) {
    throw new AppError(httpStatus.BAD_REQUEST, 'productVideo is required');
  }
  if (!allFiles.some((file) => file.fieldname === 'agreementPdf')) {
    throw new AppError(httpStatus.BAD_REQUEST, 'agreementPdf is required');
  }

  for (const file of allFiles) {
    try {
      const url = await uploadFileToS3(file, 'product-media');

      if (file.fieldname === 'productImage') {
        body.productImage = url;
      } else if (file.fieldname === 'productVideo') {
        body.productVideo = url;
      } else if (file.fieldname === 'agreementPdf') {
        body.agreementPdf = url;
      }
    } catch (error) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Failed to upload ${file.fieldname}`,
      );
    }
  }

  // Ensure bulletPoints is an array
  if (body.bulletPoints && typeof body.bulletPoints === 'string') {
    body.bulletPoints = [body.bulletPoints];
  }

  const result = await productService.createProductIntoDb(user.id, body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Product created successfully. Waiting for admin approval.',
    data: result,
  });
});

const getProductList = catchAsync(async (req, res) => {
  // const user = req.user as any;

  const result = await productService.getProductListFromDb( req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getProductsByTrainer = catchAsync(async (req, res) => {
  const result = await productService.getProductsByTrainerFromDb(
    req.params.trainerId,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Products by trainer retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getProductById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await productService.getProductByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product details retrieved successfully',
    data: result,
  });
});

const getProductByIdPublic = catchAsync(async (req, res) => {
  const result = await productService.getAProductByPublicFromDb(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product details retrieved successfully',
    data: result,
  });
});

const getMyProducts = catchAsync(async (req, res) => {
  const user = req.user as any;
  if(req.query.productName === 'true') {
    const result = await productService.getMyAllProductsNameFromDb(user.id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'My products retrieved successfully',
      data: result.data
    });
  }

  const result = await productService.getMyProductsFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My products retrieved successfully',
    stats: result.summary,
    data: result.data,
    meta: result.meta,
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const body = req.body;

  // Handle file uploads
  const allFiles = (req.files as Express.Multer.File[]) || [];

  // get the product to check old file urls
  const existingProduct = await productService.getAProductFromDb(
    user.id,
    req.params.id,
  );
  if (!existingProduct) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  for (const file of allFiles) {
    try {
      const url = await uploadFileToS3(file, 'product-media');

      if (file.fieldname === 'productImage') {
        // Delete old image if exists
        if (existingProduct[0]?.productImage) {
          await deleteFileFromSpace(existingProduct[0].productImage);
        }
        body.productImage = url;
      } else if (file.fieldname === 'productVideo') {
        // Delete old video if exists
        if (existingProduct[0]?.productVideo) {
          await deleteFileFromSpace(existingProduct[0].productVideo);
        }
        body.productVideo = url;
      } else if (file.fieldname === 'agreementPdf') {
        // Delete old agreementPdf if exists
        if (existingProduct[0]?.agreementPdf) {
          await deleteFileFromSpace(existingProduct[0].agreementPdf);
        }
        body.agreementPdf = url;
      }
    } catch (error) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to upload ${file.fieldname}`,
      );
    }
  }

  // Ensure bulletPoints is an array if provided
  if (body.bulletPoints && typeof body.bulletPoints === 'string') {
    body.bulletPoints = [body.bulletPoints];
  }

  const result = await productService.updateProductIntoDb(
    user.id,
    req.params.id,
    body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product updated successfully',
    data: result,
  });
});

const deleteProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await productService.deleteProductItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product deleted successfully',
    data: result,
  });
});

export const productController = {
  createProduct,
  getProductList,
  getProductsByTrainer,
  getMyProducts,
  getProductById,
  getProductByIdPublic,
  updateProduct,
  deleteProduct,
};

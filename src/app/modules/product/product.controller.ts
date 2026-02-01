import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { productService } from './product.service';
import { uploadFileToS3 } from '../../utils/multipleFile';
import AppError from '../../errors/AppError';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const body = req.body;

  // Handle file uploads
  const allFiles = (req.files as Express.Multer.File[]) || [];

  for (const file of allFiles) {
    try {
      const url = await uploadFileToS3(file, 'product-media');

      if (file.fieldname === 'productImage') {
        body.productImage = url;
      } else if (file.fieldname === 'productVideo') {
        body.productVideo = url;
      } else if (file.fieldname === 'pdf') {
        body.pdf = url;
      }
    } catch (error) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to upload ${file.fieldname}`,
      );
    }
  }

  const result = await productService.createProductIntoDb(user.id, body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Product created successfully',
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

  const result = await productService.getMyProductsFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My products retrieved successfully',
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
      } else if (file.fieldname === 'pdf') {
        // Delete old pdf if exists
        if (existingProduct[0]?.pdf) {
          await deleteFileFromSpace(existingProduct[0].pdf);
        }
        body.pdf = url;
      }
    } catch (error) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to upload ${file.fieldname}`,
      );
    }
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
  getMyProducts,
  getProductById,
  getProductByIdPublic,
  updateProduct,
  deleteProduct,
};

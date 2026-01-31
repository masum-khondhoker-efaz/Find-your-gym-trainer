import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { productService } from './product.service';

const createProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await productService.createProductIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Product created successfully',
    data: result,
  });
});

const getProductList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await productService.getProductListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product list retrieved successfully',
    data: result,
  });
});

const getProductById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await productService.getProductByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product details retrieved successfully',
    data: result,
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await productService.updateProductIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product updated successfully',
    data: result,
  });
});

const deleteProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await productService.deleteProductItemFromDb(user.id, req.params.id);
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
  getProductById,
  updateProduct,
  deleteProduct,
};
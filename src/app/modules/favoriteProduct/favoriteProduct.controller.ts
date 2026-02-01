import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { favoriteProductService } from './favoriteProduct.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createFavoriteProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteProductService.createFavoriteProductIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'FavoriteProduct created successfully',
    data: result,
  });
});

const getFavoriteProductList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteProductService.getFavoriteProductListFromDb(user.id,
    req.query as ISearchAndFilterOptions
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteProduct list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});


const deleteFavoriteProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteProductService.deleteFavoriteProductItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteProduct deleted successfully',
    data: result,
  });
});

export const favoriteProductController = {
  createFavoriteProduct,
  getFavoriteProductList,
  deleteFavoriteProduct,
};
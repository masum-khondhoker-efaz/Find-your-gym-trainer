import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { favoriteGymService } from './favoriteGym.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createFavoriteGym = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteGymService.createFavoriteGymIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'FavoriteGym created successfully',
    data: result,
  });
});

const getFavoriteGymList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteGymService.getFavoriteGymListFromDb(
    user.id,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteGym list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const deleteFavoriteGym = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteGymService.deleteFavoriteGymItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteGym deleted successfully',
    data: result,
  });
});

export const favoriteGymController = {
  createFavoriteGym,
  getFavoriteGymList,
  deleteFavoriteGym,
};
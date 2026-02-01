import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { favoriteTrainerService } from './favoriteTrainer.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createFavoriteTrainer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteTrainerService.createFavoriteTrainerIntoDb(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'FavoriteTrainer created successfully',
    data: result,
  });
});

const getFavoriteTrainerList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteTrainerService.getFavoriteTrainerListFromDb(
    user.id,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteTrainer list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const deleteFavoriteTrainer = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteTrainerService.deleteFavoriteTrainerItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteTrainer deleted successfully',
    data: result,
  });
});

export const favoriteTrainerController = {
  createFavoriteTrainer,
  getFavoriteTrainerList,
  deleteFavoriteTrainer,
};

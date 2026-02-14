import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { favoriteGymService } from './favoriteGym.service';

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
  const result = await favoriteGymService.getFavoriteGymListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteGym list retrieved successfully',
    data: result,
  });
});

const getFavoriteGymById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteGymService.getFavoriteGymByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteGym details retrieved successfully',
    data: result,
  });
});

const updateFavoriteGym = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteGymService.updateFavoriteGymIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteGym updated successfully',
    data: result,
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
  getFavoriteGymById,
  updateFavoriteGym,
  deleteFavoriteGym,
};
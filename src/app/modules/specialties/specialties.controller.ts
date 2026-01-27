import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { specialtiesService } from './specialties.service';

const createSpecialties = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await specialtiesService.createSpecialtiesIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Specialties created successfully',
    data: result,
  });
});

const getSpecialtiesList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await specialtiesService.getSpecialtiesListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Specialties list retrieved successfully',
    data: result,
  });
});

const getSpecialtiesById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await specialtiesService.getSpecialtiesByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Specialties details retrieved successfully',
    data: result,
  });
});

const updateSpecialties = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await specialtiesService.updateSpecialtiesIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Specialties updated successfully',
    data: result,
  });
});

const deleteSpecialties = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await specialtiesService.deleteSpecialtiesItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Specialties deleted successfully',
    data: result,
  });
});

export const specialtiesController = {
  createSpecialties,
  getSpecialtiesList,
  getSpecialtiesById,
  updateSpecialties,
  deleteSpecialties,
};
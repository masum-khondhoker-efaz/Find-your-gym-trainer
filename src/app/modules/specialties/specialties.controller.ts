import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { specialtiesService } from './specialties.service';
import AppError from '../../errors/AppError';
import { deleteFileFromSpace, uploadFileToS3 } from '../../utils/deleteImage';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createSpecialties = catchAsync(async (req, res) => {
  const user = req.user as any;
  const file = req.file;
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Specialty image file is required.');
  }

  // Upload to DigitalOcean
  const fileUrl = await uploadFileToS3(file, 'specialty-Image');

  if (!fileUrl) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to upload specialty image',
    );
  }

  req.body.specialtyImage = fileUrl.url;

  const result = await specialtiesService.createSpecialtiesIntoDb(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Specialties created successfully',
    data: result,
  });
});

const getSpecialtiesList = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await specialtiesService.getSpecialtiesListFromDb(
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Specialties list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getAllSpecialtiesList = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await specialtiesService.getAllSpecialtiesListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All specialties list retrieved successfully',
    data: result,
  });
});

const getSpecialtiesById = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await specialtiesService.getSpecialtiesByIdFromDb(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Specialties details retrieved successfully',
    data: result,
  });
});

const updateSpecialties = catchAsync(async (req, res) => {
  const user = req.user as any;
  const file = req.file;
  if (file) {
    // Upload to DigitalOcean
    const fileUrl = await uploadFileToS3(file, 'specialty-Image');
    if (!fileUrl) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to upload specialty image',
      );
    }

    // find the previous image url to delete from space
    const previousImageUrl = await specialtiesService.getSpecialtiesByIdFromDb(
      req.params.id,
    );
    if (previousImageUrl?.specialtyImage) {
      await deleteFileFromSpace(previousImageUrl.specialtyImage);
    }

    req.body.specialtyImage = fileUrl.url;
  }
  const result = await specialtiesService.updateSpecialtiesIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Specialties updated successfully',
    data: result,
  });
});

const deleteSpecialties = catchAsync(async (req, res) => {
  const user = req.user as any;
  // find the previous image url to delete from space
  const previousImageUrl = await specialtiesService.getSpecialtiesByIdFromDb(
    req.params.id,
  );
  if (previousImageUrl?.specialtyImage) {
    await deleteFileFromSpace(previousImageUrl.specialtyImage);
  }
  const result = await specialtiesService.deleteSpecialtiesItemFromDb(
    user.id,
    req.params.id,
  );
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
  getAllSpecialtiesList,
  getSpecialtiesById,
  updateSpecialties,
  deleteSpecialties,
};

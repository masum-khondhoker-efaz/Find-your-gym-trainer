import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { serviceTypesService } from './serviceTypes.service';

const createServiceTypes = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceTypesService.createServiceTypesIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'ServiceTypes created successfully',
    data: result,
  });
});

const getServiceTypesList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceTypesService.getServiceTypesListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ServiceTypes list retrieved successfully',
    data: result,
  });
});

const getServiceTypesById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceTypesService.getServiceTypesByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ServiceTypes details retrieved successfully',
    data: result,
  });
});

const updateServiceTypes = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceTypesService.updateServiceTypesIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ServiceTypes updated successfully',
    data: result,
  });
});

const deleteServiceTypes = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await serviceTypesService.deleteServiceTypesItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ServiceTypes deleted successfully',
    data: result,
  });
});

export const serviceTypesController = {
  createServiceTypes,
  getServiceTypesList,
  getServiceTypesById,
  updateServiceTypes,
  deleteServiceTypes,
};
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { customPricingService } from './customPricing.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createCustomPricing = catchAsync(async (req, res) => {
  const user = req.user as any;
  const body = req.body;

  const result = await customPricingService.createCustomPricingIntoDb(user.id, body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Custom pricing created successfully',
    data: result,
  });
});

const getCustomPricingsByProduct = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const user = req.user as any;

  // If user is authenticated (trainer route), verify ownership
  const userId = user?.id;
  const result = await customPricingService.getCustomPricingsByProductFromDb(productId, userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Custom pricings retrieved successfully',
    data: result,
  });
});

const getMyCustomPricings = catchAsync(async (req, res) => {
  const user = req.user as any;

  const result = await customPricingService.getMyCustomPricingsFromDb(
    user.id,
    req.params.productId,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My custom pricings retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getCustomPricingById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { id } = req.params;

  const result = await customPricingService.getCustomPricingByIdFromDb(user.id, id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Custom pricing details retrieved successfully',
    data: result,
  });
});

const getActiveCustomPricingForProduct = catchAsync(async (req, res) => {
  const { productId } = req.params;

  const result = await customPricingService.getActiveCustomPricingForProductFromDb(productId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result 
      ? 'Active custom pricing found' 
      : 'No active custom pricing available',
    data: result,
  });
});

const updateCustomPricing = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { id } = req.params;
  const body = req.body;

  const result = await customPricingService.updateCustomPricingIntoDb(user.id, id, body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Custom pricing updated successfully',
    data: result,
  });
});

const deleteCustomPricing = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { id } = req.params;

  const result = await customPricingService.deleteCustomPricingFromDb(user.id, id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Custom pricing deleted successfully',
    data: result,
  });
});

export const customPricingController = {
  createCustomPricing,
  getCustomPricingsByProduct,
  getMyCustomPricings,
  getCustomPricingById,
  getActiveCustomPricingForProduct,
  updateCustomPricing,
  deleteCustomPricing,
};

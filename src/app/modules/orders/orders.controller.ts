import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { ordersService } from './orders.service';

const createOrders = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await ordersService.createOrdersIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Order created successfully. Please complete payment.',
    data: result,
  });
});

const getOrdersList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await ordersService.getOrdersListFromDb(user.id, user.role);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Orders list retrieved successfully',
    data: result,
  });
});

const getOrdersById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await ordersService.getOrdersByIdFromDb(user.id, req.params.id, user.role);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order details retrieved successfully',
    data: result,
  });
});

const updateOrders = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await ordersService.updateOrdersIntoDb(
    user.id,
    req.params.id,
    req.body,
    user.role,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order updated successfully',
    data: result,
  });
});

const deleteOrders = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await ordersService.deleteOrdersItemFromDb(user.id, req.params.id, user.role);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order deleted successfully',
    data: result,
  });
});

export const ordersController = {
  createOrders,
  getOrdersList,
  getOrdersById,
  updateOrders,
  deleteOrders,
};
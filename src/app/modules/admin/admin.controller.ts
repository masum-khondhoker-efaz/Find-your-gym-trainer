import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { adminService } from './admin.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';


const getDashboardStats = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getDashboardStatsFromDb(user.id,
    req.query.earningsYear as string,
    req.query.usersYear as string
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dashboard stats retrieved successfully',
    data: result,
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAllUsersFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getAUser = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAUsersFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User details retrieved successfully',
    data: result,
  });
});

const getAllTrainers = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAllTrainersFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Trainer list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getAllPosts = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAllPostsFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Post list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getAllProducts = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAllProductsFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const updateProductVisibility = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.updateProductVisibilityIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product visibility updated successfully',
    data: result,
  });
});

const updateTrainerStatus = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.updateTrainerStatusIntoDb(
    user.id,
    req.params.id,
    // req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Trainer status updated successfully',
    data: result,
  });
});

const getATrainer  = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getATrainerFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Trainer details retrieved successfully',
    data: result,
  });
});

const getAllOrders = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAllOrdersFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order list retrieved successfully',
    data: result,
  });
});

const getAOrder  = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAOrderFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order details retrieved successfully',
    data: result,
  });
});

const getAllNewsletterSubscribers = catchAsync(async (req, res) => {
  
  const result = await adminService.getAllNewsletterSubscribersFromDb(req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Newsletter Subscribers list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.updateUserStatusIntoDb(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin updated successfully',
    data: result,
  });
});

const updatePostStatus = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.updatePostStatusIntoDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Post status updated successfully',
    data: result,
  });
});

const deleteAdmin = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.deleteAdminItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin deleted successfully',
    data: result,
  });
});

export const adminController = {
  getDashboardStats,
  getAllUsers,
  getAUser,
  getAllTrainers,
  getAllPosts,
  getAllProducts,
  updateProductVisibility,
  updateTrainerStatus,
  getATrainer,
  getAllOrders,
  getAOrder,
  getAllNewsletterSubscribers,
  updateUserStatus,
  updatePostStatus,
  deleteAdmin,
};

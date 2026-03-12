import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { reviewService } from './review.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { UserRoleEnum } from '@prisma/client';

// ==================== PRODUCT REVIEWS ====================
// Note: Product reviews automatically review the trainer who created the product

const createProductReview = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await reviewService.createProductReviewIntoDb(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Product review created successfully',
    data: result,
  });
});

const getProductReviewList = catchAsync(async (req, res) => {
  const result = await reviewService.getProductReviewListFromDb(
    req.params.productId,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product reviews retrieved successfully',
    ...((result as any).stats && { stats: (result as any).stats }),
    data: result.data,
    meta: result.meta,
  });
});

const getTrainerReviewList = catchAsync(async (req, res) => {
  const result = await reviewService.getTrainerReviewListFromDb(
    req.params.trainerId,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Trainer reviews retrieved successfully',
    ...((result as any).stats && { stats: (result as any).stats }),
    data: result.data,
    meta: result.meta,
  });
});

// ==================== SYSTEM REVIEWS ====================

const createSystemReview = catchAsync(async (req, res) => {
  const user = req.user as any;
  if (user.role !== UserRoleEnum.TRAINER) {
    const result = await reviewService.createSystemReviewIntoDb(
      user.id,
      req.body,
    );
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'System review created successfully',
      data: result,
    });
  } else {
    const result = await reviewService.createSystemReviewIntoDbForTrainer(
      user.id,
      req.body,
    );
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'System review for trainer created successfully',
      data: result,
    });
  }
});

const getSystemReviewListForWebsite = catchAsync(async (req, res) => {
  const result = await reviewService.getSystemReviewListForWebsiteFromDb(
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'System reviews retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getSystemReviewList = catchAsync(async (req, res) => {
  const result = await reviewService.getSystemReviewListFromDb(
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'System reviews retrieved successfully',
    stats: result.stats,
    data: result.data,
    meta: result.meta,
  });
});

// ==================== TRAINER REPLIES ====================

const createTrainerReply = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await reviewService.createTrainerReplyIntoDb(
    user.id,
    req.params.reviewId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Reply created successfully',
    data: result,
  });
});

// ==================== COMMON OPERATIONS ====================

const updateReview = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await reviewService.updateReviewIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Review updated successfully',
    data: result,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await reviewService.deleteReviewItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Review deleted successfully',
    data: result,
  });
});

export const reviewController = {
  // Product Reviews
  createProductReview,
  getProductReviewList,
  getTrainerReviewList,

  // System Reviews
  createSystemReview,
  getSystemReviewListForWebsite,
  getSystemReviewList,

  // Trainer Replies
  createTrainerReply,

  // Common
  updateReview,
  deleteReview,
};

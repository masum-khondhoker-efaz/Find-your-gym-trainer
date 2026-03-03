import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { reviewController } from './review.controller';
import { reviewValidation } from './review.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

// ==================== PRODUCT REVIEWS ====================
// Note: Product reviews automatically review the trainer who created the product

router.post(
  '/products',
  auth(UserRoleEnum.MEMBER),
  validateRequest(reviewValidation.createProductReviewSchema),
  reviewController.createProductReview,
);

router.get(
  '/products/:productId',
  reviewController.getProductReviewList,
);

router.get(
  '/trainer/:trainerId',
  reviewController.getTrainerReviewList,
);


// ==================== SYSTEM REVIEWS ====================

router.post(
  '/system',
  auth(UserRoleEnum.MEMBER),
  validateRequest(reviewValidation.createSystemReviewSchema),
  reviewController.createSystemReview,
);

router.get(
  '/system',
  reviewController.getSystemReviewList,
);

// ==================== TRAINER REPLIES ====================

router.post(
  '/:reviewId/reply',
  auth(UserRoleEnum.TRAINER),
  validateRequest(reviewValidation.createTrainerReplySchema),
  reviewController.createTrainerReply,
);

// ==================== COMMON OPERATIONS ====================

router.patch(
  '/:id',
  auth(UserRoleEnum.MEMBER),
  validateRequest(reviewValidation.updateReviewSchema),
  reviewController.updateReview,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  reviewController.deleteReview,
);

export const reviewRoutes = router;

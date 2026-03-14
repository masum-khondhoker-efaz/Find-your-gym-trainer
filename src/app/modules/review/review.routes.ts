import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { reviewController } from './review.controller';
import { reviewValidation } from './review.validation';
import { UserRoleEnum } from '@prisma/client';
import checkSubscriptionForTrainers from '../../middlewares/checkSubscriptionForSalonOwners';

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
  '/trainers/:trainerId',
  reviewController.getTrainerReviewList,
);


// ==================== SYSTEM REVIEWS ====================

router.post(
  '/system',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  validateRequest(reviewValidation.createSystemReviewSchema),
  reviewController.createSystemReview,
);

router.get(
  '/system-reviews',
  reviewController.getSystemReviewListForWebsite,
);

router.get(
  '/system',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  reviewController.getSystemReviewList,
);

// ==================== TRAINER REPLIES ====================

router.post(
  '/reply/:reviewId',
  auth(UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
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
  auth(UserRoleEnum.MEMBER,UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  reviewController.deleteReview,
);

router.delete(
  '/admin/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  reviewController.deleteSystemReview,
);



export const reviewRoutes = router;

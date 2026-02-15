import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { reviewController } from './review.controller';
import { reviewValidation } from './review.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.MEMBER),
  validateRequest(reviewValidation.createReviewSchema),
  reviewController.createReview,
);

router.get('/products/:id', reviewController.getReviewListForACourse);

router.get(
  '/my-product-reviews',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  reviewController.getMyReviewsForSeller,
);

router.patch(
  '/products/:id',
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

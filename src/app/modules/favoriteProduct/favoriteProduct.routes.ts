import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { favoriteProductController } from './favoriteProduct.controller';
import { favoriteProductValidation } from './favoriteProduct.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.MEMBER),
  validateRequest(favoriteProductValidation.createSchema),
  favoriteProductController.createFavoriteProduct,
);

router.get(
  '/',
  auth(UserRoleEnum.MEMBER),
  favoriteProductController.getFavoriteProductList,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.MEMBER),
  favoriteProductController.deleteFavoriteProduct,
);

export const favoriteProductRoutes = router;

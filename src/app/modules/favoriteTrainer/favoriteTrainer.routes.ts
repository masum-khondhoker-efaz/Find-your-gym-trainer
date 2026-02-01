import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { favoriteTrainerController } from './favoriteTrainer.controller';
import { favoriteTrainerValidation } from './favoriteTrainer.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.MEMBER),
  validateRequest(favoriteTrainerValidation.createSchema),
  favoriteTrainerController.createFavoriteTrainer,
);

router.get(
  '/',
  auth(UserRoleEnum.MEMBER),
  favoriteTrainerController.getFavoriteTrainerList,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.MEMBER),
  favoriteTrainerController.deleteFavoriteTrainer,
);

export const favoriteTrainerRoutes = router;

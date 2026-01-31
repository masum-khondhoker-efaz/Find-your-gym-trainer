import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { likeController } from './like.controller';
import { likeValidation } from './like.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.TRAINER),
  validateRequest(likeValidation.createSchema),
  likeController.createLike,
);

router.get('/', auth(), likeController.getLikeList);

router.get('/:id', auth(), likeController.getLikeById);

router.delete(
  '/:id',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.TRAINER),
  likeController.deleteLike,
);

export const likeRoutes = router;

import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { likeController } from './like.controller';
import { likeValidation } from './like.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(likeValidation.createSchema),
  likeController.createLike,
);

router.get('/', auth(), likeController.getLikeList);

router.get('/:id', auth(), likeController.getLikeById);

router.delete('/:id', auth(), likeController.deleteLike);

export const likeRoutes = router;
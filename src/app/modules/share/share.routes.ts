import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { shareController } from './share.controller';
import { shareValidation } from './share.validation';
import checkSubscriptionForTrainers from '../../middlewares/checkSubscriptionForSalonOwners';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  validateRequest(shareValidation.createSchema),
  shareController.createShare,
);

router.get('/', auth(), shareController.getShareList);

router.get('/:id', auth(), shareController.getShareById);

router.delete(
  '/:postId/:shareId',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  shareController.deleteShare,
);

export const shareRoutes = router;

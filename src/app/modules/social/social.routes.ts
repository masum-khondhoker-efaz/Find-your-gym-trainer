import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { socialController } from './social.controller';
import { socialValidation } from './social.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.TRAINER),
  validateRequest(socialValidation.createSchema),
  socialController.createSocial,
);

router.get('/', auth(), socialController.getSocialList);

router.get('/:id', auth(), socialController.getSocialById);

router.patch(
  '/:id',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.TRAINER),
  validateRequest(socialValidation.updateSchema),
  socialController.updateSocial,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.TRAINER),
  socialController.deleteSocial,
);

export const socialRoutes = router;

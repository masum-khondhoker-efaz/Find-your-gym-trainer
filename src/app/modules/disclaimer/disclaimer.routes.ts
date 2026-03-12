import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { disclaimerController } from './disclaimer.controller';
import { disclaimerValidation } from './disclaimer.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(disclaimerValidation.createSchema),
  disclaimerController.createDisclaimer,
);

router.get('/', disclaimerController.getDisclaimerList);

router.get('/:id', disclaimerController.getDisclaimerById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(disclaimerValidation.updateSchema),
  disclaimerController.updateDisclaimer,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  disclaimerController.deleteDisclaimer,
);

export const disclaimerRoutes = router;
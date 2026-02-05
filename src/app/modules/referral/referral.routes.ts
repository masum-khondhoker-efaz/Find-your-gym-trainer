import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { referralController } from './referral.controller';
import { referralValidation } from './referral.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.TRAINER),
  validateRequest(referralValidation.createSchema),
  referralController.createReferral,
);

router.get('/', auth(UserRoleEnum.TRAINER), referralController.getReferralList);

router.get('/:id', auth(), referralController.getReferralById);

router.patch(
  '/:id',
  auth(UserRoleEnum.TRAINER),
  validateRequest(referralValidation.updateSchema),
  referralController.updateReferral,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.TRAINER),
  referralController.deleteReferral,
);

export const referralRoutes = router;

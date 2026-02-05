import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { referralRewardSettingsController } from './referralRewardSettings.controller';
import { referralRewardSettingsValidation } from './referralRewardSettings.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(referralRewardSettingsValidation.createSchema),
  referralRewardSettingsController.createReferralRewardSettings,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  referralRewardSettingsController.getReferralRewardSettingsList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  referralRewardSettingsController.getReferralRewardSettingsById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(referralRewardSettingsValidation.updateSchema),
  referralRewardSettingsController.updateReferralRewardSettings,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  referralRewardSettingsController.deleteReferralRewardSettings,
);

export const referralRewardSettingsRoutes = router;

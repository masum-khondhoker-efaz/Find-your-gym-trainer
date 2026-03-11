import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { appliedReferralController } from './appliedReferral.controller';
import { appliedReferralValidation } from './appliedReferral.validation';

const router = express.Router();

// Validate referral code and get discount amount (for "Use" button)
router.post(
  '/validate',
  auth(UserRoleEnum.MEMBER, UserRoleEnum.TRAINER),
  validateRequest(appliedReferralValidation.createSchema),
  appliedReferralController.validateReferralCode,
);

router.post(
  '/',
  auth(),
  validateRequest(appliedReferralValidation.createSchema),
  appliedReferralController.createAppliedReferral,
);

router.get('/', auth(), appliedReferralController.getAppliedReferralList);

router.get('/:id', auth(), appliedReferralController.getAppliedReferralById);

router.put(
  '/:id',
  auth(),
  validateRequest(appliedReferralValidation.updateSchema),
  appliedReferralController.updateAppliedReferral,
);

router.delete('/:id', auth(), appliedReferralController.deleteAppliedReferral);

export const appliedReferralRoutes = router;

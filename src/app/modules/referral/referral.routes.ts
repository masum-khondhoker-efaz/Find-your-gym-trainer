import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { referralController } from './referral.controller';
import { referralValidation } from './referral.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(referralValidation.createSchema),
  referralController.createReferral,
);

router.get('/', auth(), referralController.getReferralList);

router.get('/:id', auth(), referralController.getReferralById);

router.put(
  '/:id',
  auth(),
  validateRequest(referralValidation.updateSchema),
  referralController.updateReferral,
);

router.delete('/:id', auth(), referralController.deleteReferral);

export const referralRoutes = router;

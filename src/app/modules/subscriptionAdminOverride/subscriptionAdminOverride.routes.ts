import { Router } from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { subscriptionAdminOverrideController } from './subscriptionAdminOverride.controller';
import { subscriptionAdminOverrideValidation } from './subscriptionAdminOverride.validation';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';

const router = Router();

// Middleware: Only admins can access these routes
router.use(auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN));

// Change trainer's subscription plan
router.post(
  '/:trainerId/change-plan',
  validateRequest(subscriptionAdminOverrideValidation.changeTrainerPlanValidation),
  subscriptionAdminOverrideController.changeTrainerSubscriptionPlan,
);

// Get all admin overrides (paginated)
router.get(
  '/',
  subscriptionAdminOverrideController.getAdminOverrides,
);

// Get override history for specific trainer
router.get(
  '/:trainerId/history',
  validateRequest(subscriptionAdminOverrideValidation.getOverrideHistoryValidation),
  subscriptionAdminOverrideController.getTrainerOverrideHistory,
);

// Mark trainer as notified
router.patch(
  '/:overrideId/notify',
  validateRequest(subscriptionAdminOverrideValidation.markAsNotifiedValidation),
  subscriptionAdminOverrideController.markTrainerAsNotified,
);

export default router;

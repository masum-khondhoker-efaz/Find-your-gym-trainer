import { UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { subscriptionPricingRuleController } from './subscriptionPricingRule.controller';
import { subscriptionPricingRuleValidation } from './subscriptionPricingRule.validation';

const router = express.Router();

// Admin only routes
router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(subscriptionPricingRuleValidation.createSchema),
  subscriptionPricingRuleController.createSubscriptionPricingRule,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  subscriptionPricingRuleController.getSubscriptionPricingRuleList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  subscriptionPricingRuleController.getSubscriptionPricingRuleById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(subscriptionPricingRuleValidation.updateSchema),
  subscriptionPricingRuleController.updateSubscriptionPricingRule,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  subscriptionPricingRuleController.deleteSubscriptionPricingRule,
);

// Trainer routes
router.get(
  '/applicable/me',
  auth(UserRoleEnum.TRAINER),
  subscriptionPricingRuleController.getApplicablePricingRules,
);

router.post(
  '/apply',
  auth(UserRoleEnum.TRAINER),
  validateRequest(subscriptionPricingRuleValidation.applyPricingRuleSchema),
  subscriptionPricingRuleController.applyPricingRule,
);

export const subscriptionPricingRuleRoutes = router;
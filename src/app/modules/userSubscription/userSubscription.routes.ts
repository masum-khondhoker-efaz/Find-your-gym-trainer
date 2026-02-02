import { UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { userSubscriptionController } from './userSubscription.controller';
import { userSubscriptionValidation } from './userSubscription.validation';


const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.TRAINER),
  validateRequest(userSubscriptionValidation.createSchema),
  userSubscriptionController.createUserSubscription,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  userSubscriptionController.getUserSubscriptionList,
);

router.post(
  '/create-checkout-session',
  auth(UserRoleEnum.TRAINER),
  validateRequest(userSubscriptionValidation.createCheckoutSessionSchema),
  userSubscriptionController.createCheckoutSession,
);


router.get(
  '/own-plan',
  auth(UserRoleEnum.TRAINER),
  userSubscriptionController.getUOwnerSubscriptionPlan,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  userSubscriptionController.getUserSubscriptionById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.TRAINER),
  validateRequest(userSubscriptionValidation.updateSchema),
  userSubscriptionController.updateUserSubscription,
);

router.patch(
  '/cancel-automatic-renewal/:id',
  auth(UserRoleEnum.TRAINER),
  userSubscriptionController.cancelAutomaticRenewal,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.TRAINER),
  userSubscriptionController.deleteUserSubscription,
);
router.delete(
  '/admin/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  userSubscriptionController.deleteUserSubscriptionForCustomer,
);

export const userSubscriptionRoutes = router;

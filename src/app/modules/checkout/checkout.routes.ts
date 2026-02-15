import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { checkoutController } from './checkout.controller';
import { checkoutValidation } from './checkout.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.MEMBER),
  validateRequest(checkoutValidation.createSchema),
  checkoutController.createCheckout,
);

router.post(
  '/purchase-with-cash-on-delivery/:id',
  auth(UserRoleEnum.MEMBER),
  validateRequest(checkoutValidation.markCheckoutSchema),
  checkoutController.markCheckoutPaid,
);

router.get('/', auth(UserRoleEnum.MEMBER), checkoutController.getCheckoutList);

router.get('/:id', auth(UserRoleEnum.MEMBER), checkoutController.getCheckoutById);

router.put(
  '/:id',
  auth(UserRoleEnum.MEMBER),
  validateRequest(checkoutValidation.updateSchema),
  checkoutController.updateCheckout,
);

router.patch(
  '/:id/shipping',
  auth(UserRoleEnum.MEMBER),
  validateRequest(checkoutValidation.updateShippingSchema),
  checkoutController.updateCheckoutShipping,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.MEMBER),
  checkoutController.deleteCheckout,
);

export const checkoutRoutes = router;

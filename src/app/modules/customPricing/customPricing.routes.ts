import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { customPricingController } from './customPricing.controller';
import { customPricingValidation } from './customPricing.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

// Create custom pricing (Trainer only)
router.post(
  '/',
  auth(UserRoleEnum.TRAINER),
  validateRequest(customPricingValidation.createSchema),
  customPricingController.createCustomPricing,
);

// Get all custom pricings for trainer
router.get(
  '/my-custom-pricings/:productId',
  auth(UserRoleEnum.TRAINER),
  customPricingController.getMyCustomPricings,
);

// Get custom pricing history for a specific product (Trainer only - must own the product)
router.get(
  '/my-products/:productId',
  auth(UserRoleEnum.TRAINER),
  customPricingController.getCustomPricingsByProduct,
);

// Get custom pricing by ID (Trainer only)
router.get(
  '/:id',
  auth(UserRoleEnum.TRAINER),
  customPricingController.getCustomPricingById,
);

// Get all custom pricings for a specific product (Public)
router.get(
  '/product/:productId',
  customPricingController.getCustomPricingsByProduct,
);

// Get active custom pricing for a product (Public - for checkout)
router.get(
  '/product/:productId/active',
  customPricingController.getActiveCustomPricingForProduct,
);

// Update custom pricing (Trainer only)
router.patch(
  '/:id',
  auth(UserRoleEnum.TRAINER),
  validateRequest(customPricingValidation.updateSchema),
  customPricingController.updateCustomPricing,
);

// Delete custom pricing (Trainer only)
router.delete(
  '/:id',
  auth(UserRoleEnum.TRAINER),
  customPricingController.deleteCustomPricing,
);

export const customPricingRoutes = router;

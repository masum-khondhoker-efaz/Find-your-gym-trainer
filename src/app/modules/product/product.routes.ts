import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { productController } from './product.controller';
import { productValidation } from './product.validation';
import { UserRoleEnum } from '@prisma/client';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';
import checkSubscriptionForTrainers from '../../middlewares/checkSubscriptionForSalonOwners';
import { checkTrainerPaymentReadinessBlocking } from '../../middlewares/checkTrainerPaymentReadiness';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.any(),
  parseBody,
  auth(UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  checkTrainerPaymentReadinessBlocking(),
  validateRequest(productValidation.createSchema),
  productController.createProduct,
);

router.get('/', productController.getProductList);

router.get(
  '/products-by-trainer/:trainerId',
  productController.getProductsByTrainer,
);

router.get(
  '/my-products',
  auth(UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  productController.getMyProducts,
);


router.get(
  '/my-products/:id',
  auth(UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  productController.getProductById,
);

router.get('/:id', productController.getProductByIdPublic);

router.patch(
  '/:id',
  multerUploadMultiple.any(),
  parseBody,
  auth(UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  validateRequest(productValidation.updateSchema),
  productController.updateProduct,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  productController.deleteProduct,
);

export const productRoutes = router;

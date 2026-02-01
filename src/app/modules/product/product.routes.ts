import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { productController } from './product.controller';
import { productValidation } from './product.validation';
import { UserRoleEnum } from '@prisma/client';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.any(),
  parseBody,
  auth(UserRoleEnum.TRAINER),
  validateRequest(productValidation.createSchema),
  productController.createProduct,
);

router.get('/', productController.getProductList);

router.get(
  '/my-products',
  auth(UserRoleEnum.TRAINER),
  productController.getMyProducts,
);

router.get(
  '/my-products/:id',
  auth(UserRoleEnum.TRAINER),
  productController.getProductById,
);

router.get('/:id', productController.getProductByIdPublic);

router.patch(
  '/:id',
  multerUploadMultiple.any(),
  parseBody,
  auth(UserRoleEnum.TRAINER),
  validateRequest(productValidation.updateSchema),
  productController.updateProduct,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.TRAINER),
  productController.deleteProduct,
);

export const productRoutes = router;

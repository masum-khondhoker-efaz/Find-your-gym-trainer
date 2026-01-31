import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { productController } from './product.controller';
import { productValidation } from './product.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(productValidation.createSchema),
productController.createProduct,
);

router.get('/', auth(), productController.getProductList);

router.get('/:id', auth(), productController.getProductById);

router.put(
'/:id',
auth(),
validateRequest(productValidation.updateSchema),
productController.updateProduct,
);

router.delete('/:id', auth(), productController.deleteProduct);

export const productRoutes = router;
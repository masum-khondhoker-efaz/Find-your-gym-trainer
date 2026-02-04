import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { categoryController } from './category.controller';
import { categoryValidation } from './category.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(categoryValidation.createSchema),
  categoryController.createCategory,
);

router.get('/', auth(), categoryController.getCategoryList);

router.get('/:id', auth(), categoryController.getCategoryById);

router.put(
  '/:id',
  auth(),
  validateRequest(categoryValidation.updateSchema),
  categoryController.updateCategory,
);

router.delete('/:id', auth(), categoryController.deleteCategory);

export const categoryRoutes = router;

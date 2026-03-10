import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ordersController } from './orders.controller';
import { ordersValidation } from './orders.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(ordersValidation.createSchema),
  ordersController.createOrders,
);

router.get('/', auth(), ordersController.getOrdersList);

router.get('/current-orders', auth(UserRoleEnum.TRAINER), ordersController.getTrainerOrdersList);

router.get('/:id', auth(), ordersController.getOrdersById);

router.put(
  '/:id',
  auth(),
  validateRequest(ordersValidation.updateSchema),
  ordersController.updateOrders,
);

router.delete('/:id', auth(), ordersController.deleteOrders);

export const ordersRoutes = router;

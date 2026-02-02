import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { serviceTypesController } from './serviceTypes.controller';
import { serviceTypesValidation } from './serviceTypes.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN),
  validateRequest(serviceTypesValidation.createSchema),
  serviceTypesController.createServiceTypes,
);

router.get('/', serviceTypesController.getServiceTypesList);

router.get('/:id', serviceTypesController.getServiceTypesById);

router.patch(
  '/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN),
  validateRequest(serviceTypesValidation.updateSchema),
  serviceTypesController.updateServiceTypes,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN),
  serviceTypesController.deleteServiceTypes,
);

export const serviceTypesRoutes = router;

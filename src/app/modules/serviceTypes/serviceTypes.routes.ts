import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { serviceTypesController } from './serviceTypes.controller';
import { serviceTypesValidation } from './serviceTypes.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(serviceTypesValidation.createSchema),
serviceTypesController.createServiceTypes,
);

router.get('/', auth(), serviceTypesController.getServiceTypesList);

router.get('/:id', auth(), serviceTypesController.getServiceTypesById);

router.put(
'/:id',
auth(),
validateRequest(serviceTypesValidation.updateSchema),
serviceTypesController.updateServiceTypes,
);

router.delete('/:id', auth(), serviceTypesController.deleteServiceTypes);

export const serviceTypesRoutes = router;
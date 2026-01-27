import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { specialtiesController } from './specialties.controller';
import { specialtiesValidation } from './specialties.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(specialtiesValidation.createSchema),
specialtiesController.createSpecialties,
);

router.get('/', auth(), specialtiesController.getSpecialtiesList);

router.get('/:id', auth(), specialtiesController.getSpecialtiesById);

router.put(
'/:id',
auth(),
validateRequest(specialtiesValidation.updateSchema),
specialtiesController.updateSpecialties,
);

router.delete('/:id', auth(), specialtiesController.deleteSpecialties);

export const specialtiesRoutes = router;
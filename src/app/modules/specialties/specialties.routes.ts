import { UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { specialtiesController } from './specialties.controller';
import { specialtiesValidation } from './specialties.validation';
import { parseBody } from '../../middlewares/parseBody';
import { multerUploadMultiple } from '../../utils/multipleFile';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.single('specialtyImage'),
  parseBody,
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN),
  validateRequest(specialtiesValidation.createSchema),
  specialtiesController.createSpecialties,
);

router.get('/', specialtiesController.getAllSpecialtiesList);  

router.get('/all-specialties', specialtiesController.getSpecialtiesList);


router.get('/:id', specialtiesController.getSpecialtiesById);

router.patch(
  '/:id',
  multerUploadMultiple.single('specialtyImage'),
  parseBody,
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN),
  validateRequest(specialtiesValidation.updateSchema),
  specialtiesController.updateSpecialties,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN),
  specialtiesController.deleteSpecialties,
);
export const specialtiesRoutes = router;

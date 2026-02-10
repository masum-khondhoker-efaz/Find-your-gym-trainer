import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { foundingTeamController } from './foundingTeam.controller';
import { foundingTeamValidation } from './foundingTeam.validation';
import { UserRoleEnum } from '@prisma/client';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.single('team-image'),
  parseBody,
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(foundingTeamValidation.createSchema),
  foundingTeamController.createFoundingTeam,
);

router.get('/', foundingTeamController.getFoundingTeamList);

router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  foundingTeamController.getFoundingTeamById,
);

router.patch(
  '/:id',
  multerUploadMultiple.single('team-image'),
  parseBody,
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(foundingTeamValidation.updateSchema),
  foundingTeamController.updateFoundingTeam,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  foundingTeamController.deleteFoundingTeam,
);

export const foundingTeamRoutes = router;

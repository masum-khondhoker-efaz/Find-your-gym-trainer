import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { trainersController } from './trainers.controller';
import { trainersValidation } from './trainers.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.get(
  '/find-trainers',
  //   auth(UserRoleEnum.MEMBER),
  trainersController.getTrainersList,
);


router.get(
  '/find-trainers/:id',
  /*auth(UserRoleEnum.MEMBER),*/ 
  trainersController.getTrainersById,
);

router.get(
  '/earnings',
  auth(UserRoleEnum.TRAINER),
  trainersController.getTrainerEarnings,
);

router.get(
  '/recent-transactions',
  auth(UserRoleEnum.TRAINER),
  trainersController.getTrainerRecentTransactions,
);

router.get(
  '/dashboard',
  auth(UserRoleEnum.TRAINER),
  trainersController.getTrainerDashboard,
);

export const trainersRoutes = router;

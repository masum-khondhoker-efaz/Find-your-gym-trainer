import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { trainersController } from './trainers.controller';
import { UserRoleEnum } from '@prisma/client';
import checkSubscriptionForTrainers from '../../middlewares/checkSubscriptionForSalonOwners';

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
  checkSubscriptionForTrainers(),
  trainersController.getTrainerEarnings,
);

router.get(
  '/recent-transactions',
  auth(UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  trainersController.getTrainerRecentTransactions,
);

router.get(
  '/dashboard',
  auth(UserRoleEnum.TRAINER),
  checkSubscriptionForTrainers(),
  trainersController.getTrainerDashboard,
);

export const trainersRoutes = router;

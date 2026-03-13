import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { gymController } from './gym.controller';
import { gymValidation } from './gym.validation';

const router = express.Router();

router.get(
  '/nearby-gyms',
  validateRequest(gymValidation.nearbyGymsSchema),
  gymController.getNearbyGyms,
);

router.get(
  '/nearby-gyms-auth',
  auth(),
  validateRequest(gymValidation.nearbyGymsSchema),
  gymController.getNearbyGymsAuth,
);

export const gymRoutes = router;

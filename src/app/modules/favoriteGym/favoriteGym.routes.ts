import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { favoriteGymController } from './favoriteGym.controller';
import { favoriteGymValidation } from './favoriteGym.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(favoriteGymValidation.createSchema),
favoriteGymController.createFavoriteGym,
);

router.get('/', auth(), favoriteGymController.getFavoriteGymList);

router.get('/:id', auth(), favoriteGymController.getFavoriteGymById);

router.put(
'/:id',
auth(),
validateRequest(favoriteGymValidation.updateSchema),
favoriteGymController.updateFavoriteGym,
);

router.delete('/:id', auth(), favoriteGymController.deleteFavoriteGym);

export const favoriteGymRoutes = router;
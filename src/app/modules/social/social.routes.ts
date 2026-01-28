import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { socialController } from './social.controller';
import { socialValidation } from './social.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(socialValidation.createSchema),
  socialController.createSocial,
);

router.get('/', auth(), socialController.getSocialList);

router.get('/:id', auth(), socialController.getSocialById);

router.put(
  '/:id',
  auth(),
  validateRequest(socialValidation.updateSchema),
  socialController.updateSocial,
);

router.delete('/:id', auth(), socialController.deleteSocial);

export const socialRoutes = router;

import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { shareController } from './share.controller';
import { shareValidation } from './share.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(shareValidation.createSchema),
  shareController.createShare,
);

router.get('/', auth(), shareController.getShareList);

router.get('/:id', auth(), shareController.getShareById);

router.delete('/:id', auth(), shareController.deleteShare);

export const shareRoutes = router;
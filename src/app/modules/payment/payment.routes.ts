import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { paymentController } from './payment.controller';
import { paymentValidation } from './payment.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(paymentValidation.createSchema),
  paymentController.createPayment,
);
router.post('/create-account', auth(), paymentController.createAccount);

router.post('/create-new-account', auth(), paymentController.createNewAccount);

router.get('/', auth(), paymentController.getPaymentList);

router.get('/:id', auth(), paymentController.getPaymentById);

router.post(
  '/cancel-payment',
  auth(),
  // validateRequest(cancelPaymentPayloadSchema),
  paymentController.cancelPaymentRequest,
);

router.put(
  '/:id',
  auth(),
  validateRequest(paymentValidation.updateSchema),
  paymentController.updatePayment,
);

router.delete('/:id', auth(), paymentController.deletePayment);

export const paymentRoutes = router;

import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { UserControllers } from '../user/user.controller';
import { UserValidations } from '../user/user.validation';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';
const router = express.Router();

router.post(
  '/register',
  validateRequest(UserValidations.registerUser),
  UserControllers.registerUser,
);

router.post(
  '/trainer-register',
  multerUploadMultiple.single('certificationDocument'),
  parseBody,
  validateRequest(UserValidations.trainerRegisterUser),
  UserControllers.trainerRegisterUser,
);


router.put(
  '/verify-otp',
  validateRequest(UserValidations.verifyOtpSchema),
  UserControllers.verifyOtp,
);

router.get('/me', auth(), UserControllers.getMyProfile);

router.patch(
  '/update-profile',
  auth(),
  validateRequest(UserValidations.updateProfileSchema),
  UserControllers.updateMyProfile,
);

// router.put(
//   '/update-shipping-address',
//   auth(),
//   validateRequest(UserValidations.updateAddressSchema),
//   UserControllers.updateShippingAddress,
// );

router.post(
  '/resend-verification-email',
  validateRequest(UserValidations.forgetPasswordSchema),
  UserControllers.resendUserVerificationEmail,
);

router.put('/change-password', auth(), UserControllers.changePassword);

router.post(
  '/forgot-password',
  validateRequest(UserValidations.forgetPasswordSchema),
  UserControllers.forgotPassword,
);

router.post(
  '/resend-otp',
  validateRequest(UserValidations.forgetPasswordSchema),
  UserControllers.resendOtp,
);

router.put(
  '/verify-otp-forgot-password',
  validateRequest(UserValidations.verifyOtpSchema),
  UserControllers.verifyOtpForgotPassword,
);

router.put(
  '/update-password',
  validateRequest(UserValidations.updatePasswordSchema),
  UserControllers.updatePassword,
);

router.post(
  '/social-sign-up',
  validateRequest(UserValidations.socialLoginSchema),
  UserControllers.socialLogin,
);

router.post('/delete-account', auth(), UserControllers.deleteAccount);


router.put(
  '/update-profile-image',
  multerUploadMultiple.single('profileImage'),
  auth(),
  UserControllers.updateProfileImage,
);

export const UserRouters = router;

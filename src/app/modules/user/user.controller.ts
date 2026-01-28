import { User, UserRoleEnum } from '@prisma/client';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from '../user/user.service';
import AppError from '../../errors/AppError';
import { uploadFileToS3 } from '../../utils/multipleFile';
import { log } from 'node:console';
import config from '../../../config';

const registerUser = catchAsync(async (req, res) => {
  const result = await UserServices.registerUserIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'OTP sent via your email successfully',
    data: result,
  });
});

const trainerRegisterUser = catchAsync(async (req, res) => {
  const user = req.user as any;
  const file = req.file;
  if (!file) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Certification document file is required.',
    );
  } 
  // Upload to DigitalOcean
  const fileUrl = await uploadFileToS3(file, 'trainer-certification-documents');
  const result = await UserServices.trainerRegisterUserIntoDB(user.id, req.body, fileUrl);
  

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'OTP sent via your email successfully',
    data: result,
  });
});

const resendUserVerificationEmail = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await UserServices.resendUserVerificationEmail(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'OTP sent via your email successfully',
    data: result,
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const user = req.user as any;

    const result = await UserServices.getMyProfileFromDB(user.id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Profile retrieved successfully',
      data: result,
    });
});

const updateMyProfile = catchAsync(async (req, res) => {
  const user = req.user as any;
 
    const result = await UserServices.updateMyProfileIntoDB(user.id, req.body);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'User profile updated successfully',
      data: result,
    });
});

const changePassword = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await UserServices.changePassword(user, user.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Password changed successfully',
    data: result,
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const result = await UserServices.forgotPassword(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Please check your email to get the otp!',
    data: result,
  });
});

const resendOtp = catchAsync(async (req, res) => {
  const result = await UserServices.resendOtpIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP sent successfully!',
    data: result,
  });
});


const verifyOtp = catchAsync(async (req, res) => {
  const result = await UserServices.verifyOtpInDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP verified successfully!',
    data: result,
  });
});

const verifyOtpForgotPassword = catchAsync(async (req, res) => {
  const result = await UserServices.verifyOtpForgotPasswordInDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP verified successfully!',
    data: result,
  });
});

const socialLogin = catchAsync(async (req, res) => {
  const result = await UserServices.socialLoginIntoDB(req.body);
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 365days
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User logged in successfully',
    data: result,
  });
});

const updatePassword = catchAsync(async (req, res) => {
  const result = await UserServices.updatePasswordIntoDb(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

const deleteAccount = catchAsync(async (req, res) => {
  const user = req.user as any;
  await UserServices.deleteAccountFromDB(user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    data: null,
    message: 'Account deleted successfully',
  });
});

const updateProfileImage = catchAsync(async (req, res) => {
  const user = req.user as any;
  const file = req.file;

  if (!file) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Profile image file is required.',
    );
  }

  // Upload to DigitalOcean
  const fileUrl = await uploadFileToS3(file, 'user-profile-images');

    const result = await UserServices.updateProfileImageIntoDB(
      user.id,
      fileUrl,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Profile image updated successfully',
      data: result,
    });
  
});

export const UserControllers = {
  registerUser,
  trainerRegisterUser,
  getMyProfile,
  updateMyProfile,
  changePassword,
  verifyOtpForgotPassword,
  forgotPassword,
  verifyOtp,
  socialLogin,
  updatePassword,
  resendUserVerificationEmail,
  resendOtp,
  deleteAccount,
  updateProfileImage,
};

import { User, UserRoleEnum } from '@prisma/client';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from '../user/user.service';
import AppError from '../../errors/AppError';
import { uploadFileToS3 } from '../../utils/multipleFile';
import { log } from 'node:console';
import config from '../../../config';
import { deleteFileFromSpace } from '../../utils/deleteImage';

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
  const result = await UserServices.trainerRegisterUserIntoDB(
    user.id,
    req.body,
    fileUrl,
  );

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

const getMyTrainerProfile = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await UserServices.getMyTrainerProfileFromDB(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Trainer profile retrieved successfully',
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

const updateTrainerProfile = catchAsync(async (req, res) => {
  const user = req.user as any;
  const files = req.files as Express.Multer.File[];
  let fileUrl = null;

  if (files && files.length > 0) {
    const certificationFiles = files.find(f => f.fieldname === 'certifications');
    const portfolioFiles = files.find(f => f.fieldname === 'portfolio');

    // Get existing files for deletion only if new files are uploaded
    const previousFileUrls = await UserServices.getTrainerProfileFilesForDelete(user.id);

    // Delete previous certification documents from DigitalOcean Spaces only if new ones are uploaded
    if (previousFileUrls.certifications && certificationFiles) {
      for (const certification of previousFileUrls.certifications) {
        await deleteFileFromSpace(certification);
      }
    }

    // Delete previous portfolio files from DigitalOcean Spaces only if new ones are uploaded
    if (previousFileUrls.portfolio && portfolioFiles) {
      for (const portfolioFile of previousFileUrls.portfolio) {
        await deleteFileFromSpace(portfolioFile);
      }
    }

    // Upload new certification files
    const certificationUrls = [];
    if (certificationFiles) {
      const url = await uploadFileToS3(certificationFiles, 'trainer-certifications');
      certificationUrls.push(url);
    }

    // Upload new portfolio files
    const portfolioUrls = [];
    if (portfolioFiles) {
      const url = await uploadFileToS3(portfolioFiles, 'trainer-portfolio');
      portfolioUrls.push(url);
    }

    fileUrl = {
      certifications: certificationUrls.length > 0 ? certificationUrls : null,
      portfolio: portfolioUrls.length > 0 ? portfolioUrls : null,
    };
  }

  const result = await UserServices.updateTrainerProfileIntoDB(
    user.id,
    req.body,
    fileUrl as any,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Trainer profile updated successfully',
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

  // Delete previous image from DigitalOcean Spaces
  const previousImageUrl = await UserServices.getUserProfileImageForDelete(
    user.id,
  );
  if (previousImageUrl) {
    await deleteFileFromSpace(previousImageUrl);
  }

  // Upload to DigitalOcean
  const fileUrl = await uploadFileToS3(file, 'user-profile-images');

  const result = await UserServices.updateProfileImageIntoDB(user.id, fileUrl);

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
  updateTrainerProfile,
  getMyTrainerProfile
};

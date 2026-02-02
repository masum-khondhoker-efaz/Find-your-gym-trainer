import { User, UserStatus, UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import emailSender from '../../utils/emailSender';
import { generateToken, refreshToken } from '../../utils/generateToken';
import prisma from '../../utils/prisma';
import Stripe from 'stripe';
import generateOtpToken from '../../utils/generateOtpToken';
import verifyOtp from '../../utils/verifyOtp';

// Initialize Stripe with your secret API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface UserWithOptionalPassword extends Omit<User, 'password'> {
  password?: string;
}

const sendEmail = async (to: string, subject: string, html: string) => {
  await emailSender(subject, to, html);
};

const registerUserIntoDB = async (payload: {
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
  role?: UserRoleEnum;
}) => {
  // 1. Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if(existingUser?.isDeleted){
    throw new AppError(httpStatus.NOT_FOUND, 'You cannot register with this email. Please contact support.');
  }

  if (existingUser) {
    if (existingUser.isVerified === false) {
      // send OTP email inside transaction so failures roll back DB changes
      const { otp, otpToken } = generateOtpToken(payload.email);
      await emailSender(
        'Verify Your Email',
        existingUser.email,
        `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <table width="100%" style="border-collapse: collapse;">
            <tr>
              <td style="background-color: #8FAF9A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
                <h2 style="margin: 0; font-size: 24px;">Verify your email</h2>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px;">
                <p style="font-size: 16px; margin: 0;">Hello <strong>${existingUser.fullName}</strong>,</p>
                <p style="font-size: 16px;">Please verify your email.</p>
                <div style="text-align: center; margin: 20px 0;">
                  <p style="font-size: 18px;">Your OTP is: <span style="font-weight:bold">${otp}</span><br/> This OTP will expire in 5 minutes.</p>
                </div>
                <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email.</p>
                <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>VitaKinetic Team</p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} VitaKinetic Marketplace. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </div>
        `,
      );

      const hashedPassword = await bcrypt.hash(payload.password, 12);
      //update existing user info if changed
      await prisma.user.update({
        where: { email: payload.email },
        data: {
          fullName: payload.fullName,
          password: hashedPassword,
          phoneNumber: payload.phoneNumber,
        },
      });

      return otpToken;
    }
    throw new AppError(httpStatus.CONFLICT, 'User already exists!');
  }

  // 2. Hash password
  const hashedPassword = await bcrypt.hash(payload.password, 12);

  // 3. Generate OTP + token (kept for frontend)
  const { otp, otpToken } = generateOtpToken(payload.email);

  // 4. Use a transaction so any failure (including email send) rolls back DB changes
  try {
    const { user } = await prisma.$transaction(async tx => {
      // create user with status PENDING
      const createdUser = await tx.user.create({
        data: {
          fullName: payload.fullName,
          email: payload.email,
          password: hashedPassword,
          phoneNumber: payload.phoneNumber,
          status: UserStatus.PENDING,
          role: payload.role,
          isVerified: false,
        },
      });

      if (!createdUser) {
        throw new AppError(httpStatus.BAD_REQUEST, 'User not created!');
      }

      // await tx.user.update({
      //   where: { id: createdUser.id },
      //   data: { isVerified: false },
      // });

      // send OTP email inside transaction so failures roll back DB changes
      await emailSender(
        'Verify Your Email',
        createdUser.email,
        `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <table width="100%" style="border-collapse: collapse;">
            <tr>
              <td style="background-color: #8FAF9A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
                <h2 style="margin: 0; font-size: 24px;">Verify your email</h2>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px;">
                <p style="font-size: 16px; margin: 0;">Hello <strong>${createdUser.fullName}</strong>,</p>
                <p style="font-size: 16px;">Please verify your email.</p>
                <div style="text-align: center; margin: 20px 0;">
                  <p style="font-size: 18px;">Your OTP is: <span style="font-weight:bold">${otp}</span><br/> This OTP will expire in 5 minutes.</p>
                </div>
                <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email.</p>
                <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>VitaKinetic Team</p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} VitaKinetic Marketplace. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </div>
        `,
      );

      // return created user so outer scope can return otpToken
      return { user: createdUser };
    });

    // If transaction committed successfully, return otpToken to frontend for verification
    return otpToken;
  } catch (error) {
    // Any thrown error will have already caused the transaction to rollback.
    throw error;
  }
};

//resend verification email
const resendUserVerificationEmail = async (email: string) => {
  const userData = await prisma.user.findUnique({
    where: { email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  // ✅ Generate OTP and token
  const otpToken = generateOtpToken(userData.email);

  // ✅ Send email with OTP
  await emailSender(
    'Verify Your Email',
    email,
    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <table width="100%" style="border-collapse: collapse;">
          <tr>
            <td style="background-color: #8FAF9A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
              <h2 style="margin: 0; font-size: 24px;">Verify your email</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px;">
              <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
              <p style="font-size: 16px;">Please verify your email.</p>
              <div style="text-align: center; margin: 20px 0;">
                <p style="font-size: 18px;">Your OTP is: <span style="font-weight:bold">${otpToken.otp}</span><br/> This OTP will expire in 5 minutes.</p>
              </div>
              <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email.</p>
              <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>VitaKinetic</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Team. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </div>`,
  );

  // ✅ Return token for frontend to verify later
  return otpToken; // frontend must keep this for verification
};

const getMyProfileFromDB = async (id: string) => {
  const Profile = await prisma.user.findUnique({
    where: {
      id: id,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      address: true,
      image: true,
      // isProfileComplete: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!Profile) {
    throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
  }

  return Profile;
};

const getMyTrainerProfileFromDB = async (id: string) => {
  const Profile = await prisma.trainer.findUnique({
    where: {
      userId: id,
    },
    select: {
      id: true,
      specialtyId: true,
      experienceYears: true,
      certifications: true,
      portfolio: true,
      trainerSpecialties: {
        select: {
          specialty: {
            select: {
              id: true,
              specialtyName: true,
            },
          },
        },
      },
      trainerServiceTypes: {
        select: {
          serviceType: {
            select: {
              id: true,
              serviceName: true,
            },
          },
        },
      },
    },
  });
  if (!Profile) {
    throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
  }
  return {
    id: Profile.id,
    specialtyId: Profile.specialtyId,
    experienceYears: Profile.experienceYears,
    certifications: Profile.certifications,
    portfolio: Profile.portfolio,
    specialtyName: Profile.trainerSpecialties.map(ts => ({
      id: ts.specialty.id,
      specialtyName: ts.specialty.specialtyName,
    })),
    serviceTypes: Profile.trainerServiceTypes.map(tst => ({
      id: tst.serviceType.id,
      serviceName: tst.serviceType.serviceName,
    })),
  };
};

const getMyProfileForSellerFromDB = async (id: string) => {
  const Profile = await prisma.user.findUnique({
    where: {
      id: id,
    },
    select: {
      id: true,
    },
  });
  if (!Profile) {
    throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
  }

  // flatten the response to include sellerProfile fields at top level
  return {
    id: Profile.id,
  };
};

const updateMyProfileIntoDB = async (id: string, payload: any) => {
  const userData = payload;

  // update user data
  await prisma.$transaction(async (transactionClient: any) => {
    // Update user data
    const updatedUser = await transactionClient.user.update({
      where: { id },
      data: userData,
    });

    return { updatedUser };
  });

  // Fetch and return the updated user
  const updatedUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      address: true,
    },
  });
  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found after update');
  }

  // const userWithOptionalPassword = updatedUser as UserWithOptionalPassword;
  // delete userWithOptionalPassword.password;

  return updatedUser;
};

const updateUserRoleStatusIntoDB = async (id: string, payload: any) => {
  const result = await prisma.user.update({
    where: {
      id: id,
    },
    data: payload,
  });
  return result;
};

const updateTrainerProfileIntoDB = async (
  userId: string,
  payload: {
    trainerSpecialty?: string[];
    experienceYears?: number;
    trainerServiceType?: string[];
  },
  fileUrl: {
    certifications?: string[];
    portfolio?: string[];
  },
) => {
  // 1️⃣ Find trainer by userId (ownership check)
  const existingTrainer = await prisma.trainer.findUnique({
    where: { userId },
  });

  if (!existingTrainer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Trainer profile not found!');
  }

  // 2️⃣ Build update data (partial update)
  const updateData: any = {
    ...(payload.experienceYears && {
      experienceYears: payload.experienceYears,
    }),
    ...(fileUrl?.certifications && {
      certifications: fileUrl.certifications,
    }),
    ...(fileUrl?.portfolio && {
      portfolio: fileUrl.portfolio,
    }),
  };

  // 3️⃣ Transaction for consistency
  const result = await prisma.$transaction(async tx => {
    // Update trainer profile
    const updatedTrainer = await tx.trainer.update({
      where: { userId: existingTrainer.userId },
      data: updateData,
    });

    // 4️⃣ Update service types (if provided)
    if (payload.trainerServiceType && payload.trainerServiceType.length > 0) {
      // Remove old mappings
      await tx.trainerServiceType.deleteMany({
        where: { trainerId: existingTrainer.userId },
      });

      // Insert new mappings
      await tx.trainerServiceType.createMany({
        data: payload.trainerServiceType.map(serviceTypeId => ({
          trainerId: existingTrainer.userId,
          serviceTypeId,
        })),
      });
    }
    // 5️⃣ update specialties mapping if provided
    if (payload.trainerSpecialty && payload.trainerSpecialty.length > 0) {
      // Remove old mappings
      await tx.trainerSpecialty.deleteMany({
        where: { trainerId: existingTrainer.userId },
      });
      // Insert new mappings
      await tx.trainerSpecialty.createMany({
        data: payload.trainerSpecialty.map(specialtyId => ({
          trainerId: existingTrainer.userId,
          specialtyId,
        })),
      });
    }


    return updatedTrainer;
  });

  return result;
};

const changePassword = async (
  user: any,
  userId: string,
  payload: {
    oldPassword: string;
    newPassword: string;
  },
) => {
  const userData = await prisma.user.findUnique({
    where: {
      id: userId,
      email: user.email,
      status: UserStatus.ACTIVE,
    },
  });
  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (userData.password === null) {
    throw new AppError(httpStatus.CONFLICT, 'Password not set for this user');
  }

  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.oldPassword,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Incorrect old password');
  }

  const newPasswordSameAsOld: boolean = await bcrypt.compare(
    payload.newPassword,
    userData.password,
  );

  if (newPasswordSameAsOld) {
    throw new AppError(
      httpStatus.CONFLICT,
      'New password must be different from the old password',
    );
  }

  const hashedPassword: string = await bcrypt.hash(payload.newPassword, 12);

  await prisma.user.update({
    where: {
      id: userData.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  return {
    message: 'Password changed successfully!',
  };
};

const forgotPassword = async (payload: { email: string }) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  // ✅ Generate OTP + JWT token
  const otpToken = generateOtpToken(userData.email);

  // ✅ Send email
  await emailSender(
    'Reset Your Password',
    userData.email,
    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="background-color: #8FAF9A; padding: 20px; text-align: center; color: #fff; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">Reset Password OTP</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px;">
            <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
            <p style="font-size: 16px;">Please verify your email to reset your password.</p>
            <div style="text-align: center; margin: 20px 0;">
              <p style="font-size: 18px;">Your OTP is: <span style="font-weight:bold">${otpToken.otp}</span><br/>This OTP will expire in 5 minutes.</p>
            </div>
            <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
            <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>VitaKinetic</p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} VitaKinetic Team. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>`,
  );

  // ✅ Return token to frontend for later verification
  return otpToken; // frontend must send this back with OTP for verification
};

//resend otp
const resendOtpIntoDB = async (payload: { email: string }) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  // ✅ Generate OTP + JWT token
  const otpToken = generateOtpToken(userData.email);

  // ✅ Send email
  await emailSender(
    'Reset Password OTP',
    userData.email,
    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #000000; border-radius: 10px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="background-color: #8FAF9A; padding: 20px; text-align: center; color: #fff; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">Reset Password OTP</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px;">
            <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
            <p style="font-size: 16px;">Please verify your email to reset your password.</p>
            <div style="text-align: center; margin: 20px 0;">
              <p style="font-size: 18px;">Your OTP is: <span style="font-weight:bold">${otpToken.otp}</span><br/>This OTP will expire in 5 minutes.</p>
            </div>
            <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
            <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>VitaKinetic</p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} VitaKinetic Team. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>`,
  );

  // ✅ Return token to frontend for verification
  return otpToken;
};

const verifyOtpInDB = async (bodyData: {
  email: string;
  otp: number;
  otpToken: string;
}) => {
  const userData = await prisma.user.findUnique({
    where: { email: bodyData.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Validate OTP (must include expiry check inside verifyOtp)
  const isValid = verifyOtp(bodyData.email, bodyData.otp, bodyData.otpToken);
  if (!isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP!');
  }

  // Update user as verified and active
  const updatedUser = await prisma.user.update({
    where: { email: bodyData.email },
    data: {
      status: UserStatus.ACTIVE,
      isVerified: true,
      isProfileComplete: userData.role === UserRoleEnum.MEMBER ? true : false,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      stripeCustomerId: true,
      role: true,
      image: true,
    },
  });

  // Ensure Stripe customer exists
  if (!updatedUser.stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: updatedUser.fullName,
      email: updatedUser.email,
      address: {
        city: 'Default City',
        country: 'America', // fallback for now
      },
      metadata: {
        userId: updatedUser.id,
        role: updatedUser.role,
      },
    });

    await prisma.user.update({
      where: { id: updatedUser.id },
      data: { stripeCustomerId: customer.id },
    });

    updatedUser.stripeCustomerId = customer.id;
  }
  // 7. Issue tokens
  const accessToken = await generateToken(
    {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      purpose: 'access',
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshTokenValue = await refreshToken(
    { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  return {
    id: updatedUser.id,
    name: updatedUser.fullName,
    email: updatedUser.email,
    image: updatedUser.image,
    role: updatedUser.role,
    accessToken: accessToken,
    refreshToken: refreshTokenValue,
  };
};

// verify otp
const verifyOtpForgotPasswordInDB = async (payload: {
  email: string;
  otp: number;
  otpToken: string;
}) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // ✅ Verify OTP using JWT token
  const isValid = verifyOtp(payload.email, payload.otp, payload.otpToken);
  if (!isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP!');
  }

  // ✅ Clear any existing OTP flags if needed (optional)
  await prisma.user.update({
    where: { email: payload.email },
    data: {
      isVerifiedForPasswordReset: true, // flag to allow password reset
    },
  });

  return;
};

// Define a type for the payload to improve type safety
interface SocialLoginPayload {
  fullName: string;
  email: string;
  image?: string | null;
  role?: UserRoleEnum;
  fcmToken?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
}

const socialLoginIntoDB = async (payload: SocialLoginPayload) => {
  // Prevent creating ADMIN via social sign-up
  if (
    payload.role === UserRoleEnum.ADMIN ||
    payload.role === UserRoleEnum.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Admin accounts cannot be created via social sign-up.',
    );
  }

  // Try to find existing user including roles
  let userRecord = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  let isNewUser = false;

  if (userRecord) {
    // Blocked account check
    if (userRecord.status === UserStatus.BLOCKED) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Your account is blocked. Please contact support.',
      );
    }
  } else {
    // Create new user
    const createdUser = await prisma.user.create({
      data: {
        fullName: payload.fullName,
        email: payload.email,
        image: payload.image ?? null,
        status: UserStatus.ACTIVE,
        role: payload.role,
        fcmToken: payload.fcmToken ?? null,
        phoneNumber: payload.phoneNumber ?? null,
        address: payload.address ?? null,
        isProfileComplete: payload.role === UserRoleEnum.MEMBER ? true : false,
        isVerified: true,
      },
    });

    userRecord = createdUser;
    isNewUser = true;
  }

  // Update FCM token if provided (only for existing users)
  if (payload.fcmToken && !isNewUser) {
    await prisma.user.update({
      where: { id: userRecord.id },
      data: { fcmToken: payload.fcmToken },
    });
  }

  // Build tokens
  const accessToken = await generateToken(
    {
      id: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      purpose: 'access',
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshTokenValue = await refreshToken(
    {
      id: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
    },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  // Build response
  return {
    id: userRecord.id,
    name: userRecord.fullName,
    email: userRecord.email,
    roles: [UserRoleEnum.MEMBER],
    image: userRecord.image,
    accessToken,
    refreshToken: refreshTokenValue,
  };
};

const updatePasswordIntoDb = async (payload: any) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  // ✅ Verify OTP using JWT token
  const isValid = verifyOtp(payload.email, payload.otp, payload.otpToken);
  if (!isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP!');
  }

  // Only allow password update if user has verified OTP (e.g., set a flag after OTP verification)
  if (userData.isVerifiedForPasswordReset !== true) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'OTP verification required before updating password.',
    );
  }

  const hashedPassword: string = await bcrypt.hash(payload.password, 12);
  await prisma.user.update({
    where: { email: payload.email },
    data: {
      password: hashedPassword,
      isVerifiedForPasswordReset: false, // reset flag after password update
    },
  });

  return {
    message: 'Password updated successfully!',
  };
};

const deleteAccountFromDB = async (id: string) => {
  const userData = await prisma.user.findUnique({
    where: { id },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  await prisma.user.delete({
    where: { id },
  });

  return { message: 'Account deleted successfully!' };
};

const updateProfileImageIntoDB = async (
  userId: string,
  profileImageUrl: string,
) => {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      image: profileImageUrl,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      image: true,
    },
  });

  if (!updatedUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Profile image not updated!');
  }

  return updatedUser;
};

const trainerRegisterUserIntoDB = async (
  userId: string,
  payload: {
    trainerSpecialty: string[];
    experienceYears: number;
    trainerServiceType: string[];
  },
  fileUrl: string,
) => {
  // 1. Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  // 2. Update user to trainer
  const updatedUser = await prisma.trainer.create({
    data: {
      userId: userId,
      experienceYears: payload.experienceYears,
      certifications: [fileUrl],
    },
  });
  if (updatedUser) {
    await prisma.trainerServiceType.createMany({
      data: payload.trainerServiceType.map(serviceType => ({
        trainerId: updatedUser.userId,
        serviceTypeId: serviceType,
      })),
    });
    await prisma.trainerSpecialty.createMany({
      data: payload.trainerSpecialty.map(specialty => ({
        trainerId: updatedUser.userId,
        specialtyId: specialty,
      })),
    });
  }
  if (!updatedUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Trainer not created!');
  }
  // 3. Return updated trainer profile after checking
  const trainerProfile = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      trainers: {
        include: {
          trainerSpecialties: {
            include: {
              specialty: {
                select: {
                  id: true,
                  specialtyName: true,
                },
              },
            },
          },
          trainerServiceTypes: {
            include: {
              serviceType: {
                select: {
                  id: true,
                  serviceName: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return trainerProfile;
};

const getUserProfileImageForDelete = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  return userData.image;
};

const getTrainerProfileFilesForDelete = async (userId: string) => {
  const trainerData = await prisma.trainer.findUnique({
    where: { userId: userId },
    select: { certifications: true, portfolio: true },
  });
  if (!trainerData) {
    throw new AppError(httpStatus.NOT_FOUND, 'Trainer not found!');
  }
  return trainerData;
};

export const UserServices = {
  registerUserIntoDB,
  trainerRegisterUserIntoDB,
  getMyProfileFromDB,
  getMyProfileForSellerFromDB,
  updateMyProfileIntoDB,
  updateUserRoleStatusIntoDB,
  changePassword,
  forgotPassword,
  verifyOtpInDB,
  verifyOtpForgotPasswordInDB,
  socialLoginIntoDB,
  updatePasswordIntoDb,
  resendOtpIntoDB,
  resendUserVerificationEmail,
  deleteAccountFromDB,
  updateProfileImageIntoDB,
  getUserProfileImageForDelete,
  getTrainerProfileFilesForDelete,
  updateTrainerProfileIntoDB,
  getMyTrainerProfileFromDB,
};

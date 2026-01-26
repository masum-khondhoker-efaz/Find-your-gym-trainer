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
}) => {
  // 1. Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
  });

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
              <td style="background-color: #F56100; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
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
                <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>SpareDoc Team</p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} SpareDoc Marketplace. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </div>
        `,
      );
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
        },
      });

      if (!createdUser) {
        throw new AppError(httpStatus.BAD_REQUEST, 'User not created!');
      }

      

      // send OTP email inside transaction so failures roll back DB changes
      await emailSender(
        'Verify Your Email',
        createdUser.email,
        `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <table width="100%" style="border-collapse: collapse;">
            <tr>
              <td style="background-color: #F56100; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
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
                <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>SpareDoc Team</p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} SpareDoc Marketplace. All rights reserved.</p>
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
            <td style="background-color: #F56100; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
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
              <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
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
      dateOfBirth: true,
      phoneNumber: true,
      address: true,
      image: true,
      isProfileComplete: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!Profile) {
    throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
  }
 


  return Profile;
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
      dateOfBirth: true,
      phoneNumber: true,
      gender: true,
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
          <td style="background-color: #F56100; padding: 20px; text-align: center; color: #fff; border-radius: 10px 10px 0 0;">
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
            <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Time Team. All rights reserved.</p>
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
          <td style="background-color: #F56100; padding: 20px; text-align: center; color: #fff; border-radius: 10px 10px 0 0;">
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
            <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Time Team. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>`,
  );

  // ✅ Return token to frontend for verification
  return otpToken;
};

// verify otp
const verifyOtpInDB1 = async (bodyData: {
  email: string;
  password: string;
  otp: number;
}) => {
  const userData = await prisma.user.findUnique({
    where: { email: bodyData.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.CONFLICT, 'User not found!');
  }

  const currentTime = new Date();

  // if (userData.otp !== bodyData.otp) {
  //   throw new AppError(httpStatus.CONFLICT, 'Your OTP is incorrect!');
  // }

  // if (!userData.otpExpiry || userData.otpExpiry <= currentTime) {
  //   throw new AppError(
  //     httpStatus.CONFLICT,
  //     'Your OTP has expired. Please request a new one.',
  //   );
  // }

  // Prepare common fields
  const updateData: any = {
    otp: null,
    otpExpiry: null,
  };

  // If user is not active, determine what else to update
  if (userData.status !== UserStatus.ACTIVE) {
    // updateData.status = UserStatus.ACTIVE;
  }

  await prisma.user.update({
    where: { email: bodyData.email },
    data: updateData,
  });

  // Create a new Stripe customer
  const customer = await stripe.customers.create({
    name: userData.fullName,
    email: userData.email,
    address: {
      city: userData.address ?? 'City', // You can modify this as needed
      country: 'America', // You can modify this as needed
    },
    metadata: {
      userId: userData.id,
    },
  });
  if (!customer || !customer.id) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Stripe customer not created!');
  }

  return { message: 'OTP verified successfully!' };
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
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      stripeCustomerId: true,
      role: true,
    },
  });

  // Ensure Stripe customer exists
  if (!updatedUser.stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: updatedUser.fullName,
      email: updatedUser.email,
      address: {
        city: 'Default City',
        country: 'DZA', // fallback for now
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

  return;
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
        fcmToken: payload.fcmToken ?? null,
        phoneNumber: payload.phoneNumber ?? null,
        address: payload.address ?? null,
        isProfileComplete: false,
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
      role: UserRoleEnum.MEMBER, // <-- default role
      purpose: 'access',
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshTokenValue = await refreshToken(
    {
      id: userRecord.id,
      email: userRecord.email,
      role: UserRoleEnum.MEMBER, // <-- default role
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



export const UserServices = {
  registerUserIntoDB,
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
};

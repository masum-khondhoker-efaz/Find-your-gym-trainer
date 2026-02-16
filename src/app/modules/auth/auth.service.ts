import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import { generateToken, refreshToken } from '../../utils/generateToken';
import prisma from '../../utils/prisma';
import { verifyToken } from '../../utils/verifyToken';
import { UserRoleEnum, UserStatus } from '@prisma/client';

const loginUserFromDB = async (payload: {
  email: string;
  password: string;
}) => {
  const { email, password } = payload;

  // 1️⃣ Find user with minimal required fields
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      trainers: true, // preload trainer relation if exists
    },
  });

  // Generic error to avoid user enumeration attack
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  if (!user.password) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password is not set');
  }

  // 2️⃣ Validate password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  // 3️⃣ Account status checks
  if (!user.isVerified || user.status === UserStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Please verify your email before logging in',
    );
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Your account is blocked. Please contact support.',
    );
  }

  // 4️⃣ Trainer validation
  if (user.role === UserRoleEnum.TRAINER) {
    if (!user.isProfileComplete || !user.trainers) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Trainer profile incomplete. Please complete your profile.',
      );
    }
  }

  // 5️⃣ Mark user as logged in (only if needed)
  if (!user.isLoggedIn) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isLoggedIn: true },
    });
  }

  // 6️⃣ Generate tokens
  const accessToken = await generateToken(
    { id: user.id, email: user.email, role: user.role, purpose: 'access' },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshTokenValue = await refreshToken(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    image: user.image,
    accessToken,
    refreshToken: refreshTokenValue,
  };
};



const refreshTokenFromDB = async (refreshedToken: string) => {
  if (!refreshedToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  let decoded: any;

  try {
    decoded = await verifyToken(
      refreshedToken,
      config.jwt.refresh_secret as Secret,
    );
  } catch (error) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  // Validate token purpose
  if (decoded.purpose && decoded.purpose !== 'refresh') {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const user = await prisma.user.findFirst({
    where: {
      id: decoded.id,
      status: UserStatus.ACTIVE,
      isDeleted: false,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  // Generate new tokens (rotation)
  const newAccessToken = await generateToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      purpose: 'access',
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const newRefreshToken = await generateToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      purpose: 'refresh',
    },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};


const logoutUserFromDB = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { isLoggedIn: false },
  });
};
export const AuthServices = {
  loginUserFromDB,
  logoutUserFromDB,
  refreshTokenFromDB,
};

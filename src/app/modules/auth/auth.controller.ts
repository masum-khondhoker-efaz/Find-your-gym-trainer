import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from '../auth/auth.service';
import config from '../../../config';

const loginUser = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUserFromDB(req.body);
  // console.log(process.env.NODE_ENV === 'production' ? 'lax' : 'none' , 'is the site running in production?');
   //add refresh token to cookies
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', 
    maxAge: 365 * 24 * 60 * 60 * 1000, // 365 days
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User logged in successfully',
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const refreshToken = req.headers.authorization as string;

  // console.log('refreshToken', refreshToken);

  const result = await AuthServices.refreshTokenFromDB(refreshToken);
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'none', 
    maxAge: 365 * 24 * 60 * 60 * 1000, // 7 days
  })
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Token refreshed successfully',
    data: result,
  });
});

const logoutUser = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await AuthServices.logoutUserFromDB(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    data: result,
    message: 'User logged out successfully',
  });
});

export const AuthControllers = { loginUser, logoutUser, refreshToken };

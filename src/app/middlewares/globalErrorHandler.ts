import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import AppError from '../errors/AppError';
import handleZodError from '../errors/handleZodError';
import handlePrismaError from '../errors/handlePrismaError';

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log(err);
  let statusCode = 500;
  let message = 'Something went wrong!';
  let errorDetails: Record<string, any> = {};

  if (err instanceof ZodError) {
    // Handle Zod error
    const simplifiedError = handleZodError(err);
    statusCode = simplifiedError?.statusCode || 400;
    message = simplifiedError?.message || 'Validation error';
    // errorDetails = simplifiedError?.errorDetails || {};
  } else if (
    err instanceof PrismaClientValidationError ||
    err instanceof PrismaClientKnownRequestError
  ) {
    // Handle all Prisma errors (validation and known request errors)
    const prismaError = handlePrismaError(err);
    statusCode = prismaError.statusCode;
    message = prismaError.message;
    errorDetails = prismaError.errorDetails;
  } else if (err instanceof PrismaClientUnknownRequestError) {
    // Handle Prisma unknown errors
    statusCode = 500;
    message = err.message;
    errorDetails = err;
  } else if (err instanceof TokenExpiredError) {
    // Handle JWT token expired error
    statusCode = 401;
    message = 'JWT token has expired';
    errorDetails = {
      name: err.name,
      expiredAt: err.expiredAt,
      stack: err.stack,
    };
  } else if (err instanceof JsonWebTokenError) {
    // Handle JWT token verification errors (including invalid signature)
    statusCode = 401;
    message = err.message;
    errorDetails = {
      name: err.name,
      stack: err.stack,
    };
  } else if (err instanceof AppError) {
    // Handle custom AppError
    statusCode = err.statusCode;
    message = err.message;
    errorDetails = { stack: err.stack };
  } else if (err instanceof Error) {
    // Handle generic Error
    message = err.message;
    errorDetails = { stack: err.stack };
  } else {
    // Handle unknown error
    statusCode = 500;
    message = 'An unknown error occurred';
    errorDetails = { error: err };
  }
  res.status(statusCode).json({
    success: false,
    message,
    // errorDetails,
  });
};

export default globalErrorHandler;

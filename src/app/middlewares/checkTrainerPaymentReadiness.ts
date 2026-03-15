import { User, UserRoleEnum } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { verifyTrainerPaymentReadiness } from '../utils/trainerPaymentTransfer';
import sendResponse from '../utils/sendResponse';

/**
 * Non-blocking middleware to check if a trainer can receive payments
 * This validates that the trainer has completed Stripe onboarding
 * and has a connected Stripe account.
 *
 * Usage: Use for monitoring/logging purposes only
 */
const checkTrainerPaymentReadiness = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // If no trainerId provided, skip validation
      const trainerId =
        req.body?.trainerId || req.query?.trainerId || req.user?.id;

      if (!trainerId) {
        return next();
      }
      if (req.user?.role !== UserRoleEnum.TRAINER) {
        return next();
      }

      // Verify trainer payment readiness
      const readinessCheck = await verifyTrainerPaymentReadiness(
        trainerId as string,
      );

      if (!readinessCheck.ready) {
        console.warn(
          `⚠️ Trainer payment readiness check failed: ${readinessCheck.reason}`,
        );

        // Don't block the request, but log the issue
        // The payment transfer will handle the error
        return next();
      }

      console.log(`✅ Trainer ${trainerId} is ready to receive payments`);
      next();
    } catch (error) {
      console.error('Error checking trainer payment readiness:', error);
      // Don't block the request on validation error
      next();
    }
  };
};

/**
 * BLOCKING middleware to enforce trainer payment readiness
 * This prevents trainers from taking actions (creating products, etc.)
 * until they've completed Stripe onboarding.
 *
 * Usage: Apply to routes that require trainer to be payment-ready
 * Examples:
 * - POST /products (trainer creating product)
 * - POST /orders (trainer assigning to product)
 */
const checkTrainerPaymentReadinessBlocking = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;

      // Only check trainers
      if (!user || user.role !== UserRoleEnum.TRAINER) {
        return next();
      }

      // Verify trainer payment readiness
      const readinessCheck = await verifyTrainerPaymentReadiness(user.id);

      if (!readinessCheck.ready) {
        console.warn(
          `🛑 Blocked action for unready trainer: ${readinessCheck.reason}`,
        );

        return sendResponse(res, {
          statusCode: httpStatus.FORBIDDEN,
          success: false,
          message: `You cannot perform this action until you complete Stripe onboarding. Reason: ${readinessCheck.reason}`,
          data: {
            required: {
              stripeOnboarding: true,
              accountStatus: readinessCheck.accountStatus || null,
            },
          },
        });
      }

      console.log(`✅ Trainer ${user.id} passed payment readiness check`);
      next();
    } catch (error) {
      console.error('Error in payment readiness blocking check:', error);
      return sendResponse(res, {
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: 'Unable to verify payment readiness. Please try again later.',
        data: null,
      });
    }
  };
};

export default checkTrainerPaymentReadiness;
export { checkTrainerPaymentReadinessBlocking };

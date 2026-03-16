import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { subscriptionAdminOverrideService } from './subscriptionAdminOverride.service';

const changeTrainerSubscriptionPlan = catchAsync(
  async (req: Request, res: Response) => {
    const adminId = req.user?.userId; // From auth middleware
    const { trainerId } = req.params;
    const { newSubscriptionOfferId, overridePrice, note } = req.body;

    const result =
      await subscriptionAdminOverrideService.changeTrainerSubscriptionPlanInDb(
        adminId,
        trainerId,
        {
          newSubscriptionOfferId,
          overridePrice,
          note,
        },
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Trainer subscription plan changed successfully',
      data: result,
    });
  },
);

const getAdminOverrides = catchAsync(
  async (req: Request, res: Response) => {
    const adminId = req.user?.userId;
    const { page, limit } = req.query;

    const result =
      await subscriptionAdminOverrideService.getSubscriptionAdminOverridesFromDb(
        adminId,
        {
          page,
          limit,
        },
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Admin overrides retrieved successfully',
      data: result,
    });
  },
);

const getTrainerOverrideHistory = catchAsync(
  async (req: Request, res: Response) => {
    const adminId = req.user?.userId;
    const { trainerId } = req.params;

    const result =
      await subscriptionAdminOverrideService.getTrainerOverrideHistoryFromDb(
        adminId,
        trainerId,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Trainer override history retrieved successfully',
      data: result,
    });
  },
);

const markTrainerAsNotified = catchAsync(
  async (req: Request, res: Response) => {
    const adminId = req.user?.userId;
    const { overrideId } = req.params;

    const result =
      await subscriptionAdminOverrideService.markTrainerAsNotifiedFromDb(
        adminId,
        overrideId,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Trainer marked as notified',
      data: result,
    });
  },
);

export const subscriptionAdminOverrideController = {
  changeTrainerSubscriptionPlan,
  getAdminOverrides,
  getTrainerOverrideHistory,
  markTrainerAsNotified,
};

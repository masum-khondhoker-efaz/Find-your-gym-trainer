import prisma from '../../utils/prisma';
import { UserStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

/**
 * Admin changes a trainer's subscription plan
 * Steps:
 * 1. Cancel current auto-renewal (ends after current period)
 * 2. Create override record (documents what changed)
 * 3. New subscription starts next billing period
 */
const changeTrainerSubscriptionPlanInDb = async (
  adminId: string,
  trainerId: string,
  data: {
    newSubscriptionOfferId: string;
    overridePrice?: number; // Optional: custom price for new plan
    note?: string; // Reason for change
  },
) => {
  // Step 1: Verify admin
  const admin = await prisma.admin.findFirst({
    where: {
      userId: adminId,
      user: { status: UserStatus.ACTIVE },
    },
  });

  if (!admin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only admins can change trainer plans',
    );
  }

  // Step 2: Get trainer and their current subscription
  const trainer = await prisma.user.findUnique({
    where: { id: trainerId },
    include: {
      userSubscriptions: {
        where: {
          paymentStatus: { in: [PaymentStatus.COMPLETED, PaymentStatus.PENDING] },
          endDate: { gt: new Date() }, // Active subscription
        },
        include: {
          subscriptionOffer: true,
        },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!trainer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Trainer not found');
  }

  if (trainer.userSubscriptions.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Trainer has no active subscription to change',
    );
  }

  const currentSubscription = trainer.userSubscriptions[0];

  // Step 3: Verify new subscription offer exists
  const newSubscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: data.newSubscriptionOfferId },
  });

  if (!newSubscriptionOffer) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'New subscription offer not found',
    );
  }

  // Step 4: Calculate effective date (start of next month)
  const now = new Date();
  const effectiveFrom = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Step 5: Execute changes in transaction
  const result = await prisma.$transaction(async tx => {
    // 5A: Cancel current subscription (mark as CANCELLED)
    const cancelledSubscription = await tx.userSubscription.update({
      where: { id: currentSubscription.id },
      data: {
        paymentStatus: PaymentStatus.CANCELLED,
      },
    });

    // 5B: Create override record to document the change
    const override = await tx.subscriptionAdminOverride.create({
      data: {
        userId: trainerId,
        userSubscriptionId: currentSubscription.id,
        previousOfferId: currentSubscription.subscriptionOfferId!,
        newOfferId: data.newSubscriptionOfferId,
        overridePrice: data.overridePrice || newSubscriptionOffer.price,
        note: data.note || `Changed from ${currentSubscription.subscriptionOffer.title} to ${newSubscriptionOffer.title}`,
        approvedByAdminId: adminId,
        effectiveFrom: effectiveFrom,
        trainerNotified: false,
      },
    });

    // 5C: Create new subscription starting from effective date
    const newSubscription = await tx.userSubscription.create({
      data: {
        userId: trainerId,
        subscriptionOfferId: data.newSubscriptionOfferId,
        startDate: effectiveFrom,
        endDate: new Date(
          effectiveFrom.getFullYear(),
          effectiveFrom.getMonth() + 1,
          effectiveFrom.getDate(),
        ), // One month from start
        paymentStatus: PaymentStatus.PENDING, // Will be completed on next billing
      },
    });

    // 5D: Update user's subscription plan
    await tx.user.update({
      where: { id: trainerId },
      data: {
        subscriptionPlan: newSubscriptionOffer.planType,
      },
    });

    // 5E: Cancel in Stripe if subscription exists
    if (trainer.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(trainer.stripeSubscriptionId, {
          metadata: {
            cancelledBy: adminId,
            reason: 'Admin plan change',
          },
        });
      } catch (error: any) {
        console.error('Stripe cancellation error:', error.message);
        // Don't throw - continue with local cancellation
      }
    }

    return {
      override,
      currentSubscription: cancelledSubscription,
      newSubscription,
      effectiveFrom,
      message: `Plan successfully changed. Current plan ends on ${currentSubscription.endDate.toLocaleDateString()}. New plan starts on ${effectiveFrom.toLocaleDateString()}`,
    };
  });

  return result;
};

/**
 * Get subscription admin overrides list (for audit/history)
 */
const getSubscriptionAdminOverridesFromDb = async (
  adminId: string,
  options: any = {},
) => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.max(1, Number(options.limit) || 10);
  const skip = (page - 1) * limit;

  // Verify admin
  const admin = await prisma.admin.findFirst({
    where: {
      userId: adminId,
      user: { status: UserStatus.ACTIVE },
    },
  });

  if (!admin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only admins can view override records',
    );
  }

  const [result, total] = await prisma.$transaction([
    prisma.subscriptionAdminOverride.findMany({
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.subscriptionAdminOverride.count(),
  ]);

  return {
    data: result,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Get override details for a specific trainer
 */
const getTrainerOverrideHistoryFromDb = async (
  adminId: string,
  trainerId: string,
) => {
  // Verify admin
  const admin = await prisma.admin.findFirst({
    where: {
      userId: adminId,
      user: { status: UserStatus.ACTIVE },
    },
  });

  if (!admin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only admins can view override records',
    );
  }

  const overrides = await prisma.subscriptionAdminOverride.findMany({
    where: { userId: trainerId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      subscription: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return overrides;
};

/**
 * Mark trainer as notified about plan change
 */
const markTrainerAsNotifiedFromDb = async (
  adminId: string,
  overrideId: string,
) => {
  // Verify admin
  const admin = await prisma.admin.findFirst({
    where: {
      userId: adminId,
      user: { status: UserStatus.ACTIVE },
    },
  });

  if (!admin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only admins can update override records',
    );
  }

  const updated = await prisma.subscriptionAdminOverride.update({
    where: { id: overrideId },
    data: {
      trainerNotified: true,
    },
  });

  return updated;
};

export const subscriptionAdminOverrideService = {
  changeTrainerSubscriptionPlanInDb,
  getSubscriptionAdminOverridesFromDb,
  getTrainerOverrideHistoryFromDb,
  markTrainerAsNotifiedFromDb,
};

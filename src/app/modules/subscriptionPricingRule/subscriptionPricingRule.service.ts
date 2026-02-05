import prisma from '../../utils/prisma';
import { PricingRuleType, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createSubscriptionPricingRuleIntoDb = async (
  userId: string,
  data: {
    subscriptionOfferId: string;
    name: string;
    type: PricingRuleType;
    discountPercent?: number;
    discountAmount?: number;
    maxSubscribers?: number;
    startDate?: string;
    endDate?: string;
    durationMonths?: number;
    isActive?: boolean;
    trainerIds?: string[];
  },
) => {
  // Verify user is admin
  const admin = await prisma.admin.findFirst({
    where: {
      userId: userId,
      user: { status: UserStatus.ACTIVE },
    },
  });

  if (!admin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only admins can create pricing rules',
    );
  }

  // Verify subscription offer exists
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: data.subscriptionOfferId },
  });

  if (!subscriptionOffer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription offer not found');
  }

  // Create pricing rule in transaction
  const result = await prisma.$transaction(async tx => {
    const pricingRule = await tx.subscriptionPricingRule.create({
      data: {
        userId: userId,
        subscriptionOfferId: data.subscriptionOfferId,
        name: data.name,
        type: data.type,
        discountPercent: data.discountPercent,
        discountAmount: data.discountAmount,
        maxSubscribers: data.maxSubscribers,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        durationMonths: data.durationMonths,
        isActive: data.isActive ?? true,
      },
    });

    // If SPECIFIC_TRAINER type, create trainer associations
    if (
      data.type === PricingRuleType.SPECIFIC_TRAINER &&
      data.trainerIds &&
      data.trainerIds.length > 0
    ) {
      const trainerAssociations = data.trainerIds.map(trainerId => ({
        pricingRuleId: pricingRule.id,
        trainerId: trainerId,
      }));

      await tx.subscriptionPricingRuleTrainer.createMany({
        data: trainerAssociations,
      });
    }

    return pricingRule;
  });

  return result;
};

const getSubscriptionPricingRuleListFromDb = async (userId: string) => {
  const result = await prisma.subscriptionPricingRule.findMany({
    include: {
      subscriptionOffer: {
        select: {
          id: true,
          title: true,
          price: true,
          planType: true,
          duration: true,
        },
      },
      subscriptionPricingRuleTrainers: {
        include: {
          trainer: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      usages: {
        select: {
          id: true,
          userId: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (result.length === 0) {
    return { message: 'No pricing rules found' };
  }

  return result.map(rule => ({
    ...rule,
    usageCount: rule.usages.length,
    remainingSlots:
      rule.maxSubscribers !== null
        ? Math.max(0, rule.maxSubscribers - rule.usageCount)
        : null,
    trainers: rule.subscriptionPricingRuleTrainers.map(t => ({
      id: t.trainer.userId,
      name: t.trainer.user.fullName,
      email: t.trainer.user.email,
    })),
  }));
};

const getSubscriptionPricingRuleByIdFromDb = async (
  userId: string,
  subscriptionPricingRuleId: string,
) => {
  const result = await prisma.subscriptionPricingRule.findUnique({
    where: {
      id: subscriptionPricingRuleId,
    },
    include: {
      subscriptionOffer: {
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          planType: true,
          duration: true,
        },
      },
      subscriptionPricingRuleTrainers: {
        include: {
          trainer: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      },
      usages: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Pricing rule not found');
  }

  return {
    ...result,
    usageCount: result.usages.length,
    remainingSlots:
      result.maxSubscribers !== null
        ? Math.max(0, result.maxSubscribers - result.usageCount)
        : null,
    trainers: result.subscriptionPricingRuleTrainers.map(t => ({
      id: t.trainer.userId,
      name: t.trainer.user.fullName,
      email: t.trainer.user.email,
      image: t.trainer.user.image,
    })),
  };
};

const updateSubscriptionPricingRuleIntoDb = async (
  userId: string,
  subscriptionPricingRuleId: string,
  data: {
    name?: string;
    discountPercent?: number;
    discountAmount?: number;
    maxSubscribers?: number;
    startDate?: string;
    endDate?: string;
    durationMonths?: number;
    isActive?: boolean;
    trainerIds?: string[];
  },
) => {
  // Verify user is admin
  const admin = await prisma.admin.findFirst({
    where: {
      userId: userId,
      user: { status: UserStatus.ACTIVE },
    },
  });

  if (!admin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only admins can update pricing rules',
    );
  }

  const existingRule = await prisma.subscriptionPricingRule.findUnique({
    where: { id: subscriptionPricingRuleId },
  });

  if (!existingRule) {
    throw new AppError(httpStatus.NOT_FOUND, 'Pricing rule not found');
  }

  const result = await prisma.$transaction(async tx => {
    const updatedRule = await tx.subscriptionPricingRule.update({
      where: {
        id: subscriptionPricingRuleId,
      },
      data: {
        name: data.name,
        discountPercent: data.discountPercent,
        discountAmount: data.discountAmount,
        maxSubscribers: data.maxSubscribers,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        durationMonths: data.durationMonths,
        isActive: data.isActive,
      },
    });

    // Update trainer associations if provided
    if (
      existingRule.type === PricingRuleType.SPECIFIC_TRAINER &&
      data.trainerIds
    ) {
      // Delete existing associations
      await tx.subscriptionPricingRuleTrainer.deleteMany({
        where: { pricingRuleId: subscriptionPricingRuleId },
      });

      // Create new associations
      if (data.trainerIds.length > 0) {
        const trainerAssociations = data.trainerIds.map(trainerId => ({
          pricingRuleId: subscriptionPricingRuleId,
          trainerId: trainerId,
        }));

        await tx.subscriptionPricingRuleTrainer.createMany({
          data: trainerAssociations,
        });
      }
    }

    return updatedRule;
  });

  return result;
};

const deleteSubscriptionPricingRuleItemFromDb = async (
  userId: string,
  subscriptionPricingRuleId: string,
) => {
  // Verify user is admin
  const admin = await prisma.admin.findFirst({
    where: {
      userId: userId,
      user: { status: UserStatus.ACTIVE },
    },
  });

  if (!admin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only admins can delete pricing rules',
    );
  }

  // Check if rule has been used
  const usageCount = await prisma.subscriptionPricingUsage.count({
    where: { pricingRuleId: subscriptionPricingRuleId },
  });

  if (usageCount > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot delete pricing rule that has been used ${usageCount} time(s). Consider deactivating it instead.`,
    );
  }

  const deletedItem = await prisma.$transaction(async tx => {
    // Delete trainer associations first
    await tx.subscriptionPricingRuleTrainer.deleteMany({
      where: { pricingRuleId: subscriptionPricingRuleId },
    });

    // Delete the rule
    const deleted = await tx.subscriptionPricingRule.delete({
      where: {
        id: subscriptionPricingRuleId,
      },
    });

    return deleted;
  });

  return deletedItem;
};

const getApplicablePricingRulesForTrainer = async (
  trainerId: string,
  subscriptionOfferId: string,
) => {
  const trainer = await prisma.trainer.findUnique({
    where: { userId: trainerId },
  });

  if (!trainer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Trainer not found');
  }

  const now = new Date();

  const applicableRules = await prisma.subscriptionPricingRule.findMany({
    where: {
      subscriptionOfferId: subscriptionOfferId,
      isActive: true,
      OR: [
        // TIME_BASED rules
        {
          type: PricingRuleType.TIME_BASED,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        // FIRST_COME rules with available slots
        {
          type: PricingRuleType.FIRST_COME,
          usageCount: { lt: prisma.subscriptionPricingRule.fields.maxSubscribers },
        },
        // SPECIFIC_TRAINER rules for this trainer
        {
          type: PricingRuleType.SPECIFIC_TRAINER,
          subscriptionPricingRuleTrainers: {
            some: { trainerId: trainerId },
          },
        },
        // REFERRAL rules
        {
          type: PricingRuleType.REFERRAL,
        },
      ],
    },
    include: {
      subscriptionOffer: {
        select: {
          id: true,
          title: true,
          price: true,
          planType: true,
        },
      },
    },
    orderBy: [
      { discountPercent: 'desc' },
      { discountAmount: 'desc' },
    ],
  });

  // Check if trainer has already used each rule
  const usedRules = await prisma.subscriptionPricingUsage.findMany({
    where: {
      userId: trainerId,
      pricingRuleId: { in: applicableRules.map(r => r.id) },
    },
    select: { pricingRuleId: true },
  });

  const usedRuleIds = new Set(usedRules.map(u => u.pricingRuleId));

  return applicableRules
    .filter(rule => !usedRuleIds.has(rule.id))
    .map(rule => {
      const originalPrice = rule.subscriptionOffer.price;
      let discountedPrice = originalPrice;

      if (rule.discountPercent) {
        discountedPrice = originalPrice * (1 - rule.discountPercent / 100);
      } else if (rule.discountAmount) {
        discountedPrice = originalPrice - rule.discountAmount;
      }

      discountedPrice = Math.max(0, discountedPrice);

      return {
        ...rule,
        originalPrice,
        discountedPrice,
        savings: originalPrice - discountedPrice,
        remainingSlots:
          rule.maxSubscribers !== null
            ? Math.max(0, rule.maxSubscribers - rule.usageCount)
            : null,
      };
    });
};

const applyPricingRule = async (
  userId: string,
  pricingRuleId: string,
  subscriptionId: string,
) => {
  // Verify pricing rule exists and is active
  const pricingRule = await prisma.subscriptionPricingRule.findUnique({
    where: { id: pricingRuleId },
    include: {
      subscriptionOffer: true,
      subscriptionPricingRuleTrainers: true,
    },
  });

  if (!pricingRule || !pricingRule.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Pricing rule not found or inactive',
    );
  }

  // Check if user has already used this rule
  const existingUsage = await prisma.subscriptionPricingUsage.findUnique({
    where: {
      pricingRuleId_userId: {
        pricingRuleId: pricingRuleId,
        userId: userId,
      },
    },
  });

  if (existingUsage) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You have already used this pricing rule',
    );
  }

  // Validate rule type specific conditions
  const now = new Date();

  if (pricingRule.type === PricingRuleType.TIME_BASED) {
    if (
      !pricingRule.startDate ||
      !pricingRule.endDate ||
      now < pricingRule.startDate ||
      now > pricingRule.endDate
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This pricing rule is not currently active',
      );
    }
  }

  if (pricingRule.type === PricingRuleType.FIRST_COME) {
    if (
      pricingRule.maxSubscribers &&
      pricingRule.usageCount >= pricingRule.maxSubscribers
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This pricing rule has reached its maximum subscribers',
      );
    }
  }

  if (pricingRule.type === PricingRuleType.SPECIFIC_TRAINER) {
    const isEligibleTrainer =
      pricingRule.subscriptionPricingRuleTrainers.some(
        t => t.trainerId === userId,
      );

    if (!isEligibleTrainer) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not eligible for this pricing rule',
      );
    }
  }

  // Create usage record and update count
  const result = await prisma.$transaction(async tx => {
    const usage = await tx.subscriptionPricingUsage.create({
      data: {
        pricingRuleId: pricingRuleId,
        userId: userId,
        subscriptionId: subscriptionId,
      },
    });

    await tx.subscriptionPricingRule.update({
      where: { id: pricingRuleId },
      data: { usageCount: { increment: 1 } },
    });

    return usage;
  });

  return result;
};

export const subscriptionPricingRuleService = {
  createSubscriptionPricingRuleIntoDb,
  getSubscriptionPricingRuleListFromDb,
  getSubscriptionPricingRuleByIdFromDb,
  updateSubscriptionPricingRuleIntoDb,
  deleteSubscriptionPricingRuleItemFromDb,
  getApplicablePricingRulesForTrainer,
  applyPricingRule,
};
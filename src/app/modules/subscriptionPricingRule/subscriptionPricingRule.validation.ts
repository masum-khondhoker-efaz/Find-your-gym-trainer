import { PricingRuleType } from '@prisma/client';
import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    subscriptionOfferId: z.string().min(1, 'Subscription offer ID is required'),
    name: z.string().min(1, 'Name is required'),
    type: z.nativeEnum(PricingRuleType, {
      errorMap: () => ({
        message: 'Type must be one of: FIRST_COME, SPECIFIC_TRAINER, TIME_BASED, REFERRAL',
      }),
    }),
    discountPercent: z
      .number()
      .min(0, 'Discount percent must be at least 0')
      .max(100, 'Discount percent cannot exceed 100')
      .optional(),
    discountAmount: z
      .number()
      .min(0, 'Discount amount must be at least 0')
      .optional(),
    maxSubscribers: z
      .number()
      .int()
      .min(1, 'Max subscribers must be at least 1')
      .optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    durationMonths: z
      .number()
      .int()
      .min(1, 'Duration must be at least 1 month')
      .optional(),
    isActive: z.boolean().optional(),
    trainerIds: z.array(z.string()).optional(), // For SPECIFIC_TRAINER type
  }).refine(
    data => {
      // Must have either discountPercent or discountAmount
      return data.discountPercent !== undefined || data.discountAmount !== undefined;
    },
    {
      message: 'Either discountPercent or discountAmount must be provided',
    },
  ).refine(
    data => {
      // If TIME_BASED, must have startDate and endDate
      if (data.type === PricingRuleType.TIME_BASED) {
        return data.startDate && data.endDate;
      }
      return true;
    },
    {
      message: 'TIME_BASED rules must have startDate and endDate',
    },
  ).refine(
    data => {
      // If FIRST_COME, must have maxSubscribers
      if (data.type === PricingRuleType.FIRST_COME) {
        return data.maxSubscribers !== undefined;
      }
      return true;
    },
    {
      message: 'FIRST_COME rules must have maxSubscribers',
    },
  ).refine(
    data => {
      // If SPECIFIC_TRAINER, must have trainerIds
      if (data.type === PricingRuleType.SPECIFIC_TRAINER) {
        return data.trainerIds && data.trainerIds.length > 0;
      }
      return true;
    },
    {
      message: 'SPECIFIC_TRAINER rules must have at least one trainerId',
    },
  ),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    discountPercent: z
      .number()
      .min(0, 'Discount percent must be at least 0')
      .max(100, 'Discount percent cannot exceed 100')
      .optional(),
    discountAmount: z
      .number()
      .min(0, 'Discount amount must be at least 0')
      .optional(),
    maxSubscribers: z
      .number()
      .int()
      .min(1, 'Max subscribers must be at least 1')
      .optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    durationMonths: z
      .number()
      .int()
      .min(1, 'Duration must be at least 1 month')
      .optional(),
    isActive: z.boolean().optional(),
    trainerIds: z.array(z.string()).optional(),
  }),
});

const applyPricingRuleSchema = z.object({
  body: z.object({
    pricingRuleId: z.string().min(1, 'Pricing rule ID is required'),
    subscriptionOfferId: z.string().min(1, 'Subscription offer ID is required'),
  }),
});

export const subscriptionPricingRuleValidation = {
  createSchema,
  updateSchema,
  applyPricingRuleSchema,
};
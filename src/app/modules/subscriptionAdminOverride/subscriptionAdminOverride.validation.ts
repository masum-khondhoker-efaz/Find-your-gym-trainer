import { z } from 'zod';

const changeTrainerPlanValidation = z.object({
  body: z.object({
    newSubscriptionOfferId: z
      .string()
      .min(1, 'New subscription offer ID is required'),
    overridePrice: z
      .number()
      .positive('Override price must be positive')
      .optional(),
    note: z
      .string()
      .max(500, 'Note must be 500 characters or less')
      .optional(),
  }),
  params: z.object({
    trainerId: z.string().min(1, 'Trainer ID is required'),
  }),
});

const getOverrideHistoryValidation = z.object({
  params: z.object({
    trainerId: z.string().min(1, 'Trainer ID is required'),
  }),
});

const markAsNotifiedValidation = z.object({
  params: z.object({
    overrideId: z.string().min(1, 'Override ID is required'),
  }),
});

export const subscriptionAdminOverrideValidation = {
  changeTrainerPlanValidation,
  getOverrideHistoryValidation,
  markAsNotifiedValidation,
};

import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    rewardAmount: z.union([z.string(), z.number()])
      .transform((val) => typeof val === 'string' ? Number(val) : val)
      .refine((val) => !isNaN(val) && val > 0, { 
        message: 'Reward amount must be a valid positive number' 
      })
  }),
});

const updateSchema = z.object({
  body: z.object({
    rewardAmount: z.union([z.string(), z.number()])
      .transform((val) => typeof val === 'string' ? Number(val) : val)
      .refine((val) => !isNaN(val) && val > 0, { 
        message: 'Reward amount must be a valid positive number' 
      })
      .optional(),
  }),
});

export const referralRewardSettingsValidation = {
  createSchema,
  updateSchema,
};

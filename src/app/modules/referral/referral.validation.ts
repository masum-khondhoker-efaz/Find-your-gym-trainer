import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    referralCode: z.string().min(1, 'Referral code is required'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    referralCode: z.string().optional(),
  }),
});

export const referralValidation = {
  createSchema,
  updateSchema,
};

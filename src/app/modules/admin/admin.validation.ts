import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
  }),
});

const updateTrainerStatusSchema = z.object({
  body: z.object({
    isProfileComplete: z.boolean({
      required_error: 'isProfileComplete status is required',
    }),
  }),
});

const updateProductVisibilitySchema = z.object({
  body: z.object({
    isVisible: z.boolean({
      required_error: 'isVisible status is required',
    }),
  }),
});

export const adminValidation = {
  createSchema,
  updateSchema,
  updateTrainerStatusSchema,
  updateProductVisibilitySchema,
};

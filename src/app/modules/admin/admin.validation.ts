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
    isActive: z.boolean({
      required_error: 'isActive status is required',
    }),
  }),
});

const createAdminSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
  }),
});

export const adminValidation = {
  createSchema,
  updateSchema,
  updateTrainerStatusSchema,
  updateProductVisibilitySchema,
  createAdminSchema,
};

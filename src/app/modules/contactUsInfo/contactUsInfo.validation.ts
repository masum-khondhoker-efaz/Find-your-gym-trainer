import { z } from 'zod';

const ContactUsInfoSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    phoneNumber: z
      .string()
      .min(5, 'Phone number must be at least 5 characters')
      .max(20, 'Phone number must not exceed 20 characters'),
    location: z.string().optional(),
    facebook: z.string().url('Facebook must be a valid URL').optional(),
    instagram: z.string().url('Instagram must be a valid URL').optional(),
    twitter: z.string().url('Twitter must be a valid URL').optional(),
    linkedin: z.string().url('LinkedIn must be a valid URL').optional(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').optional(),
    phoneNumber: z
      .string()
      .min(5, 'Phone number must be at least 5 characters')
      .max(20, 'Phone number must not exceed 20 characters')
      .optional(),
    location: z.string().optional(),
    facebook: z.string().url('Facebook must be a valid URL').optional(),
    instagram: z.string().url('Instagram must be a valid URL').optional(),
    twitter: z.string().url('Twitter must be a valid URL').optional(),
    linkedin: z.string().url('LinkedIn must be a valid URL').optional(),
  }),
});

export const contactUsInfoValidation = {
  ContactUsInfoSchema,
  updateSchema,
};

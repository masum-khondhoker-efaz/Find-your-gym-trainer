import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    userName: z.string().min(1, 'User name is required').optional(),
    userEmail: z.string().email('Invalid email format').optional(),
    userPhone: z.string().optional(),
    type: z.enum(
      [
        'GENERAL_INQUIRY',
        'TECHNICAL_SUPPORT',
        'PARTNERSHIP',
        'FEEDBACK',
        'OTHER',
      ],
      {
        errorMap: () => ({
          message: 'Type is required and must be one of the specified values',
        }),
      },
    ),
    message: z.string().min(1, 'Message is required'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    type: z.enum(
      [
        'GENERAL_INQUIRY',
        'TECHNICAL_SUPPORT',
        'PARTNERSHIP',
        'FEEDBACK',
        'OTHER',
      ],
      {
        errorMap: () => ({
          message: 'Type is required and must be one of the specified values',
        }),
      },
    ),
    message: z.string().min(1, 'Message is required'),
  }),
});

export const supportValidation = {
  createSchema,
  updateSchema,
};

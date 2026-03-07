import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    customPrice: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(0, 'Custom price must be at least 0')),
    limit: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Limit must be at least 1')),
    startDate: z.string().min(1, 'Start date is required').transform(val => new Date(val)),
    endDate: z.string().min(1, 'End date is required').transform(val => new Date(val)),
    weeks: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Weeks must be at least 1')),
    invoiceFrequency: z.enum(['ONE_TIME', 'WEEKLY', 'MONTHLY', 'ANNUALLY'], {
      required_error: 'Invoice frequency is required',
      invalid_type_error: 'Invoice frequency must be ONE_TIME, WEEKLY, MONTHLY, or ANNUALLY',
    }),
  }),
});

const updateSchema = z.object({
  body: z.object({
    customPrice: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(0, 'Custom price must be at least 0')).optional(),
    limit: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Limit must be at least 1')).optional(),
    startDate: z.string().transform(val => new Date(val)).optional(),
    endDate: z.string().transform(val => new Date(val)).optional(),
    weeks: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Weeks must be at least 1')).optional(),
    invoiceFrequency: z.enum(['ONE_TIME', 'WEEKLY', 'MONTHLY', 'ANNUALLY']).optional(),
  }),
});

export const customPricingValidation = {
  createSchema,
  updateSchema,
};

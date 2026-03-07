import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    productName: z.string().min(1, 'Product name is required'),
    durationWeeks: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Duration weeks is required')),
    hoursPerWeek: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Hours per week must be at least 1')).optional(),
    capacity: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Capacity must be at least 1')).optional(),
    price: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(0, 'Price must be at least 0')),
    invoiceFrequency: z.enum(['ONE_TIME', 'WEEKLY', 'MONTHLY', 'ANNUALLY'], {
      required_error: 'Invoice frequency is required',
      invalid_type_error: 'Invoice frequency must be ONE_TIME, WEEKLY, MONTHLY, or ANNUALLY',
    }),
    description: z.string().min(1, 'Description is required'),
    bulletPoints: z.union([
      z.string().transform(val => [val]),
      z.array(z.string()).min(1, 'At least one bullet point is required')
    ]),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    isActive: z.union([z.string(), z.boolean()]).pipe(z.coerce.boolean()).optional(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    productName: z.string().optional(),
    durationWeeks: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Duration weeks must be at least 1')).optional(),
    hoursPerWeek: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Hours per week must be at least 1')).optional(),
    capacity: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Capacity must be at least 1')).optional(),
    price: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(0, 'Price must be at least 0')).optional(),
    invoiceFrequency: z.enum(['ONE_TIME', 'WEEKLY', 'MONTHLY', 'ANNUALLY']).optional(),
    description: z.string().optional(),
    bulletPoints: z.union([
      z.string().transform(val => [val]),
      z.array(z.string())
    ]).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    isActive: z.union([z.string(), z.boolean()]).pipe(z.coerce.boolean()).optional(),
  }),
});

export const productValidation = {
createSchema,
updateSchema,
};
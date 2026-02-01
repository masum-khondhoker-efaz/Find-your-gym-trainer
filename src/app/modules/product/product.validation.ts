import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    productName: z.string().min(1, 'Product name is required'),
    week: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Week is required')),
    agreement: z.string().min(1, 'Agreement is required'),
    price: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(0, 'Price must be at least 0')),
    discount: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(0, 'Discount price must be at least 0')).optional(),
    description: z.string().min(1, 'Description is required'),
    }),
});

const updateSchema = z.object({
  body: z.object({
    productName: z.string().optional(),
    week: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(1, 'Week must be at least 1')).optional(),
    agreement: z.string().optional(),
    price: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(0, 'Price must be at least 0')).optional(),
    discount: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(0, 'Discount price must be at least 0')).optional(),
    description: z.string().optional(), 
    }),
});

export const productValidation = {
createSchema,
updateSchema,
};
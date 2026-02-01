import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
  }),
});

export const favoriteProductValidation = {
  createSchema,
};

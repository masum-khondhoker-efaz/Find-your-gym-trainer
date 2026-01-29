import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Content is required'),
    image: z.string().optional(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    content: z.string().optional(),
    image: z.string().optional(),
  }),
});

export const postValidation = {
  createSchema,
  updateSchema,
};
import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    content: z.string({
      required_error: 'Content is required!',
    }),
  }),
});

const updateSchema = z.object({
  body: z.object({
    content: z.string().optional(),
  }),
});

export const disclaimerValidation = {
createSchema,
updateSchema,
};
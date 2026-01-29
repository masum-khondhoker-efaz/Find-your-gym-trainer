import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    postId: z.string().min(1, 'Post ID is required'),
  }),
});

export const likeValidation = {
  createSchema,
};
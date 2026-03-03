import { z } from 'zod';

const createProductReviewSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    rating: z
      .number()
      .int()
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5'),
    comment: z.string().min(1, 'Comment is required'),
  }),
});

const createSystemReviewSchema = z.object({
  body: z.object({
    rating: z
      .number()
      .int()
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5'),
    comment: z.string().min(1, 'Comment is required'),
  }),
});

const createTrainerReplySchema = z.object({
  body: z.object({
    reply: z.string().min(1, 'Reply is required'),
  }),
});

const updateReviewSchema = z.object({
  body: z.object({
    rating: z
      .number()
      .int()
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5')
      .optional(),
    comment: z.string().optional(),
  }),
});

export const reviewValidation = {
  createProductReviewSchema,
  createSystemReviewSchema,
  createTrainerReplySchema,
  updateReviewSchema,
};

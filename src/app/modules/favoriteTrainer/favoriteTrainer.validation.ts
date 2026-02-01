import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    trainerId: z.string().min(1, 'Trainer ID is required'),
  }),
});

export const favoriteTrainerValidation = {
  createSchema,
};

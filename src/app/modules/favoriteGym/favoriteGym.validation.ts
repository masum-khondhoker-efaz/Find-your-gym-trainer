import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    gymName: z.string().min(1, 'Name is required'),
    }),
});

const updateSchema = z.object({
  body: z.object({
    gymName: z.string().optional(),
    }),
});

export const favoriteGymValidation = {
createSchema,
updateSchema,
};
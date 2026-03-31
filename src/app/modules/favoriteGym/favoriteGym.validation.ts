import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    gymName: z.string().min(1, 'Name is required'),
    gymAddress: z.string().min(1, 'Address is required'),
    latitude: z.number(),
    longitude: z.number(),
    imageUrl: z.string(),
    googlePlaceId: z.string().min(1, 'Google Place ID is required'),
  }),
});

export const favoriteGymValidation = {
  createSchema,
};
import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    gymName: z.string().min(1, 'Gym name is required'),
    gymAddress: z.string().min(1, 'Gym address is required'),
    googlePlaceId: z.string().min(1, 'googlePlaceId is required'),
    latitude: z.number(),
    longitude: z.number(),
    imageUrl: z.string(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    gymName: z.string().optional(),
    gymAddress: z.string().optional(),
    googlePlaceId: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    imageUrl: z.string().optional(),
    }),
});

const nearbyGymsSchema = z.object({
  query: z.object({
    latitude: z.string({ required_error: 'latitude is required' }),
    longitude: z.string({ required_error: 'longitude is required' }),
    radiusKm: z.string().optional(),
    gymName: z.string().optional(),
    avgRating: z.string().optional(),
  }),
});

export const gymValidation = {
createSchema,
updateSchema,
nearbyGymsSchema,
};
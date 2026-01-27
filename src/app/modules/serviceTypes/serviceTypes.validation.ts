import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    serviceName: z.string().min(1, 'Name is required'),
    }),
});

const updateSchema = z.object({
  body: z.object({
    serviceName: z.string().optional(),
    }),
});

export const serviceTypesValidation = {
createSchema,
updateSchema,
};
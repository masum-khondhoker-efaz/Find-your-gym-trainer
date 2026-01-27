import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    specialtyName: z.string().min(1, 'Name is required'),
    }),
});

const updateSchema = z.object({
  body: z.object({
    specialtyName: z.string().optional(),
    }),
});

export const specialtiesValidation = {
createSchema,
updateSchema,
};
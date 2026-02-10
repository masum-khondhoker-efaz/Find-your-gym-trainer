import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    role: z.string().min(1, 'Role is required'),
    linkedin: z.string().url('Invalid URL').optional(),
    twitter: z.string().url('Invalid URL').optional(),
    instagram: z.string().url('Invalid URL').optional(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    role: z.string().optional(),
    linkedin: z.string().url('Invalid URL').optional(),
    twitter: z.string().url('Invalid URL').optional(),
    instagram: z.string().url('Invalid URL').optional(),
    }),
});

export const foundingTeamValidation = {
createSchema,
updateSchema,
};
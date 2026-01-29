import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    platforms: z
      .array(
        z.object({
          platformType: z
            .string()
            .transform(val => val.toUpperCase())
            .pipe(
              z.enum(['FACEBOOK', 'X', 'LINKEDIN'], {
                required_error: 'Platform type is required!',
              }),
            ),
          platformUrl: z.string().url('Invalid platform URL'),
        }),
      )
      .min(1, 'At least one platform is required!'),
  }),
});

export const updateSchema = z.object({
  body: z
    .object({
      platformType: z
        .string()
        .transform(val => val.toUpperCase())
        .pipe(
          z.enum(['FACEBOOK', 'X', 'LINKEDIN'], {
            required_error: 'Platform type is required!',
          }),
        ),
      platformUrl: z.string().url('Invalid platform URL').optional(),
    })
    .refine(data => Object.keys(data).length > 0, {
      message: 'At least one field must be provided to update',
    }),
});

export const socialValidation = {
  createSchema,
  updateSchema,
};

import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    platforms: z.array(
      z.object({
        platformType: z.enum(
          ['Facebook', 'X', 'LinkedIn'],
          {
            required_error: 'Platform type is required!',
          },
        ),
        platformUrl: z.string().min(1, 'Platform URL is required!'),
      })
    ).min(1, 'At least one platform is required!'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    platforms: z.array(
      z.object({
        platformType: z.enum(
          ['Facebook', 'X', 'LinkedIn'],
          {
            required_error: 'Platform type is required!',
          },
        ),
        platformUrl: z.string().min(1, 'Platform URL is required!'),
      })
    ).min(1, 'At least one platform is required!'),
  }),
});

export const socialValidation = {
  createSchema,
  updateSchema,
};

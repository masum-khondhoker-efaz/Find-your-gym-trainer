import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    all: z.boolean().optional(), // checkout all items if true
    productIds: z.array(z.string()).optional(), // specific courseIds for partial checkout
  }),
});

const markCheckoutSchema = z.object({
  params: z.object({
    checkoutId: z.string().optional(),
    paymentId: z.string().optional(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
    all: z.boolean().optional(), // checkout all items if true
    productIds: z.array(z.string()).optional(), // specific courseIds for partial checkout
  }),
});

const updateShippingSchema = z.object({
  body: z.object({
    shippingSelections: z.array(
      z.object({
        checkoutItemId: z.string(),
        shippingOptionId: z.string(),
      }),
    ).min(1, 'At least one shipping selection is required'),
  }),
});

export const checkoutValidation = {
  createSchema,
  updateSchema,
  markCheckoutSchema,
  updateShippingSchema,
};

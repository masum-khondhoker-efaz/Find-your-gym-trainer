import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Product ID is required' }),
    }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    }),
});

const AuthorizedPaymentPayloadSchema = z.object({
  body: z.object({
    checkoutId: z.string({ required_error: 'Checkout ID is required' }),
  }),
});


const capturedPaymentPayloadSchema = z.object({
  paymentIntentId: z.string({
    required_error: 'Payment Intent ID is required',
  }),
});

export const paymentValidation = {
createSchema,
updateSchema,
AuthorizedPaymentPayloadSchema,
capturedPaymentPayloadSchema,
};
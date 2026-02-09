import { z } from 'zod';
import { OrderStatus, PaymentStatus } from '@prisma/client';

const createSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Product ID is required' }),
    trainerId: z.string().optional(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    status: z.nativeEnum(OrderStatus).optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  }),
});

export const ordersValidation = {
  createSchema,
  updateSchema,
};
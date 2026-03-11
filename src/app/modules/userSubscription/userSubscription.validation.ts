import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    paymentMethodId: z.string({
      required_error: 'Payment Method Id is required!',
    }),
    subscriptionOfferId: z.string({
      required_error: 'Subscription Offer Id is required!',
    }),
  }),
});

const updateSchema = z.object({
  body: z.object({
    paymentMethodId: z.string({
      required_error: 'Payment Method Id is required!',
    }),
    subscriptionOfferId: z.string({
      required_error: 'Subscription Offer Id is required!',
    }),
  }),
});

const createCheckoutSessionSchema = z.object({
  body: z.object({
    subscriptionOfferId: z.string({
      required_error: 'Subscription Offer Id is required!',
    }),
    pricingRuleId: z.string().optional(),
    referralCode: z.string().optional(),
  }),
});

export const userSubscriptionValidation = {
  createSchema,
  updateSchema,
  createCheckoutSessionSchema,
};

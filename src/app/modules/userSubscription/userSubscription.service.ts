import prisma from '../../utils/prisma';
import {
  AppliedReferralStatus,
  PaymentStatus,
  PricingRuleType,
  Prisma,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import Stripe from 'stripe';
import config from '../../../config';
import emailSender from '../../utils/emailSender';

// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});
0;

// Helper function to generate a unique, readable referral code
const generateReferralCode = (userId: string, fullName: string): string => {
  // Get last 8 characters of MongoDB ObjectId (ensures uniqueness)
  const idSuffix = userId.slice(-8).toUpperCase();
  
  // Get first 3 letters of name (if available) and make uppercase
  const namePrefix = fullName
    .replace(/[^a-zA-Z]/g, '') // Remove non-alphabetic characters
    .slice(0, 3)
    .toUpperCase() || 'REF';
  
  // Combine: e.g., "JOH-A1B2C3D4"
  return `${namePrefix}-${idSuffix}`;
};

const createUserSubscriptionIntoDb = async (
  userId: string,
  data: {
    paymentMethodId: string;
    subscriptionOfferId: string;
    subscriptionPriceId: string;
    invoiceId: string;
    stripeSubscriptionId: string;
    subscriptionWithPeriod: {
      current_period_start: number;
      current_period_end: number;
    };
  },
) => {
  // 1. Get user (outside transaction)

  const existingSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId: userId,
      endDate: {
        gt: new Date(),
      },
      paymentStatus: PaymentStatus.COMPLETED,
    },
  });
  if (existingSubscription) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'An active subscription already exists for this user',
    );
  }

  const userCheck = await prisma.user.findUnique({
    where: {
      id: userId,
      role: UserRoleEnum.TRAINER,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      address: true,
      status: true,
      stripeCustomerId: true,
    },
  });
  if (!userCheck)
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found or inactive');

  // // 2. Ensure Stripe customer exists (outside transaction)
  // let stripeCustomerId = userCheck.stripeCustomerId;
  // if (!stripeCustomerId) {
  //   const customer = await stripe.customers.create({
  //     email: userCheck.email!,
  //     name: userCheck.fullName!,
  //     address: {
  //       city: userCheck.address ?? 'City',
  //       country: 'US',
  //     },
  //     metadata: { userId: userCheck.id, role: userCheck.role },
  //   });

  //   // Update DB (outside transaction)
  //   await prisma.user.update({
  //     where: { id: userId },
  //     data: { stripeCustomerId: customer.id },
  //   });

  //   stripeCustomerId = customer.id;
  // }

  // // 3. Attach payment method (outside transaction)
  // try {
  //   await stripe.paymentMethods.attach(data.paymentMethodId, {
  //     customer: stripeCustomerId,
  //   });
  // } catch (err: any) {
  //   if (err.code !== 'resource_already_attached') throw err;
  // }

  // // 4. Set default payment method (outside transaction)
  // await stripe.customers.update(stripeCustomerId, {
  //   invoice_settings: { default_payment_method: data.paymentMethodId },
  // });

  // 5. Fetch subscription offer (outside transaction)
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: data.subscriptionOfferId },
    include: { creator: { select: { stripeCustomerId: true } } },
  });
  if (!subscriptionOffer?.stripePriceId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription offer or price not found',
    );
  }

  // check if user is trying to subscribe to their own plan
  // if (subscriptionOffer.creator.stripeCustomerId === stripeCustomerId) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'You cannot subscribe to your own subscription plan',
  //   );
  // }

  // check in stripe that the user is already not subscribed to this plan
  const existingStripeSubscriptions = await stripe.subscriptions.list({
    customer: userCheck.stripeCustomerId!,
    status: 'active',
    expand: ['data.items'],
  });
  const isAlreadySubscribed = existingStripeSubscriptions.data.some(sub =>
    sub.items.data.some(item => item.price.id === data.subscriptionPriceId),
  );
  if (isAlreadySubscribed) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You are already subscribed to this plan',
    );
  }

  // 6. Create subscription in Stripe (outside transaction)
  // const subscription = await stripe.subscriptions.create({
  //   customer: stripeCustomerId,
  //   items: [{ price: subscriptionOffer.stripePriceId }],
  //   default_payment_method: data.paymentMethodId,
  //   expand: ['latest_invoice.payment_intent'],
  //   metadata: {
  //     userId: userId,
  //     subscriptionOfferId: data.subscriptionOfferId,
  //     createdBy: 'api-direct', // Helps identify source
  //   },
  // });

  // Extract details

  // After successful payment check, send invoice

  // 7. ONLY database operations go inside the transaction
  const result = await prisma.$transaction(
    async tx => {
      // Convert Stripe Unix timestamps to JavaScript Date objects
      const startDate = data.subscriptionWithPeriod.current_period_start
        ? new Date(data.subscriptionWithPeriod.current_period_start * 1000)
        : new Date();

      const endDate = data.subscriptionWithPeriod.current_period_end
        ? new Date(data.subscriptionWithPeriod.current_period_end * 1000)
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const createdSubscription = await tx.userSubscription.create({
        data: {
          userId: userCheck.id,
          subscriptionOfferId: data.subscriptionOfferId,
          startDate: startDate,
          endDate: endDate,
          stripeSubscriptionId: data.stripeSubscriptionId,
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      await tx.payment.create({
        data: {
          stripeSubscriptionId: data.subscriptionOfferId,
          paymentAmount: subscriptionOffer.price,
          amountProvider: userCheck.stripeCustomerId!,
          status: PaymentStatus.COMPLETED,
          // paymentIntentId: paymentIntent?.id,
          invoiceId: data.invoiceId,
          user: {
            connect: { id: userId },
          },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: endDate,
          subscriptionPlan: subscriptionOffer.planType,
          stripeSubscriptionId: data.stripeSubscriptionId,
        },
      });

      return {
        ...createdSubscription,
        subscriptionId: subscriptionOffer.id,
        // paymentIntentId: paymentIntent?.id,
      };
    },
    {
      // Optional: Increase timeout if needed (default is 5000ms)
      timeout: 10000, // 10 seconds
    },
  );

  return result;
};

// NEW: Lightweight function specifically for webhook
const createUserSubscriptionFromWebhook = async (
  userId: string,
  subscriptionOfferId: string,
  stripeSubscriptionId: string,
  current_period_start: number,
  current_period_end: number,
) => {
  // Check for existing subscription
  const existingSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId: userId,
      endDate: {
        gt: new Date(),
      },
      paymentStatus: PaymentStatus.COMPLETED,
    },
  });

  if (existingSubscription) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'An active subscription already exists for this user',
    );
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
      role: UserRoleEnum.TRAINER,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      stripeCustomerId: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found or inactive');
  }

  // Get subscription offer
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: subscriptionOfferId },
  });

  if (!subscriptionOffer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription offer not found');
  }

  // Get subscription details from Stripe (no modifications, just reading)
  const subscription = await stripe.subscriptions.retrieve(
    stripeSubscriptionId,
    {
      expand: ['latest_invoice'],
    },
  );

  const startDate = new Date(current_period_start * 1000);
  const endDate = new Date(current_period_end * 1000);
  // const latestInvoice = subscription.latest_invoice as any;

  // Only database operations in transaction
  const result = await prisma.$transaction(
    async tx => {
      const createdSubscription = await tx.userSubscription.create({
        data: {
          userId: user.id,
          subscriptionOfferId: subscriptionOffer.id,
          startDate: startDate,
          endDate: endDate,
          stripeSubscriptionId: subscription.id,
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      // await tx.payment.create({
      //   data: {
      //     stripeSubscriptionId: subscription.id,
      //     paymentAmount: subscriptionOffer.price,
      //     amountProvider: user.stripeCustomerId!,
      //     status: PaymentStatus.COMPLETED,
      //     invoiceId: latestInvoice?.id,
      //     user: {
      //       connect: { id: userId },
      //     },
      //   },
      // });

      await tx.user.update({
        where: { id: userId },
        data: {
          isProfileComplete: true, // Subscription completion means profile is complete
          isSubscribed: true,
          subscriptionEnd: endDate,
          subscriptionPlan: subscriptionOffer.planType,
          stripeSubscriptionId: subscription.id,
        },
      });

      // Generate and create unique referral code for the user
      const referralCode = generateReferralCode(user.id, user.fullName);
      
      // Check if referral already exists for this user
      const existingReferral = await tx.referral.findFirst({
        where: { userId: user.id },
      });

      if (!existingReferral) {
        // Create referral code entry
        await tx.referral.create({
          data: {
            userId: user.id,
            referralCode: referralCode,
          },
        });
      }

      return createdSubscription;
    },
    {
      timeout: 10000,
    },
  );

  return result;
};

const getTrainerSubscriptionPlanFromDb = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionPlan: true,
      isSubscribed: true,
      subscriptionEnd: true,
      stripeSubscriptionId: true,
      userSubscriptions: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          subscriptionOffer: {
            select: {
              id: true,
              planType: true,
              price: true,
              duration: true,
              description: true,
            },
          },
        },
        where: { paymentStatus: PaymentStatus.COMPLETED },
      },
    },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  const subscription = user.userSubscriptions[0];
  return {
    subscriptionPlan: user.subscriptionPlan,
    isSubscribed: user.isSubscribed,
    subscriptionStart: subscription?.startDate,
    subscriptionEnd: user.subscriptionEnd,
    stripeSubscriptionId: user.stripeSubscriptionId,
    duration: subscription?.subscriptionOffer?.duration,
    price: subscription?.subscriptionOffer?.price,
    description: subscription?.subscriptionOffer?.description,
  };
};

const getUserSubscriptionListFromDb = async (userId: string) => {
  const result = await prisma.userSubscription.findMany({
    include: {
      subscriptionOffer: true,
    },
  });
  if (result.length === 0) {
    return { message: 'No userSubscription found' };
  }
  return result.map(item => ({
    ...item,
    subscriptionOffer: item.subscriptionOffer,
  }));
};

const getUserSubscriptionByIdFromDb = async (
  userId: string,
  userSubscriptionId: string,
) => {
  const result = await prisma.userSubscription.findUnique({
    where: {
      id: userSubscriptionId,
    },
    include: {
      subscriptionOffer: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'userSubscription not found');
  }
  return {
    ...result,
    subscriptionOffer: result.subscriptionOffer,
  };
};

const updateUserSubscriptionIntoDb = async (
  userId: string,
  userSubscriptionId: string,
  data: {
    paymentMethodId: string;
    subscriptionOfferId: string;
  },
) => {
  // Step 1: find user subscription (outside transaction)
  const existing = await prisma.userSubscription.findFirst({
    where: {
      id: userSubscriptionId,
      userId,
      // Remove the endDate filter to find both active and expired
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
  }

  // Optional: Add business logic if you only want to allow renewing near expiration
  if (existing.endDate > new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription is still active, cannot renew yet',
    );
  }

  // Step 2: find user (outside transaction)
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (!user.stripeCustomerId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Stripe customer not found');
  }

  // Step 3: find subscription offer (outside transaction)
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: data.subscriptionOfferId },
    include: {
      creator: {
        select: {
          stripeCustomerId: true,
        },
      },
    },
  });
  if (!subscriptionOffer?.stripePriceId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription offer or price not found',
    );
  }

  // Step 4: Handle payment method (outside transaction)
  try {
    await stripe.paymentMethods.attach(data.paymentMethodId, {
      customer: user.stripeCustomerId,
    });
  } catch (err: any) {
    if (err.code !== 'resource_already_attached') throw err;
  }

  // Set default payment method
  await stripe.customers.update(user.stripeCustomerId, {
    invoice_settings: { default_payment_method: data.paymentMethodId },
  });

  // Step 5: renew subscription in Stripe (outside transaction)
  const subscription = await stripe.subscriptions.create({
    customer: user.stripeCustomerId,
    items: [{ price: subscriptionOffer.stripePriceId }],
    default_payment_method: data.paymentMethodId,
    expand: ['latest_invoice.payment_intent'],
  });

  if (!subscription) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Subscription not created');
  }

  // IMPORTANT: Subscription may start as `incomplete` until invoice is paid
  const latestInvoice = subscription.latest_invoice as any;
  const paymentIntent = latestInvoice?.payment_intent;
  if (
    subscription.status === 'incomplete' &&
    paymentIntent?.status !== 'succeeded'
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Subscription payment failed');
  }

  // Type assertion for subscription dates
  const subscriptionWithPeriod =
    subscription as unknown as Stripe.Subscription & {
      current_period_start: number;
      current_period_end: number;
    };

  // Step 6: ONLY database operations inside transaction
  const result = await prisma.$transaction(
    async tx => {
      // Convert Stripe Unix timestamps to JavaScript Date objects
      const startDate = subscriptionWithPeriod.current_period_start
        ? new Date(subscriptionWithPeriod.current_period_start * 1000)
        : new Date();

      const endDate = subscriptionWithPeriod.current_period_end
        ? new Date(subscriptionWithPeriod.current_period_end * 1000)
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Update user subscription in DB
      const updatedSubscription = await tx.userSubscription.update({
        where: { id: userSubscriptionId },
        data: {
          subscriptionOfferId: data.subscriptionOfferId,
          startDate: startDate,
          endDate: endDate,
          stripeSubscriptionId: subscription.id,
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      // Record payment
      await tx.payment.create({
        data: {
          userId: userId,
          stripeSubscriptionId: subscription.id,
          paymentAmount: subscriptionOffer.price,
          amountProvider: user.stripeCustomerId!,
          status: PaymentStatus.COMPLETED,
        },
      });

      // Update user status
      await tx.user.update({
        where: { id: userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: endDate,
        },
      });

      return {
        ...updatedSubscription,
        subscriptionId: subscription.id,
        paymentIntentId: paymentIntent?.id,
      };
    },
    {
      timeout: 10000, // Optional: Increase timeout if needed
    },
  );

  return result;
};

const cancelAutomaticRenewalIntoDb = async (
  userId: string,
  userSubscriptionId: string,
) => {
  const result = await prisma.$transaction(async tx => {
    // Step 1: Find existing subscription for THIS USER
    const existing = await tx.userSubscription.findFirst({
      where: {
        id: userSubscriptionId,
        userId: userId, // ← CRITICAL: Add user filter
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });
    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
    }
    if (!existing.stripeSubscriptionId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Stripe subscription ID missing',
      );
    }
    // Step 2: Update Stripe subscription to cancel at period end
    try {
      console.log(
        'Setting Stripe subscription to cancel at period end:',
        existing.stripeSubscriptionId,
      );
      await stripe.subscriptions.update(existing.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      console.log(
        'Stripe subscription set to cancel at period end:',
        existing.stripeSubscriptionId,
      );
    } catch (err) {
      console.error('Error updating Stripe subscription:', err);
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Failed to update Stripe subscription',
      );
    }
    // Step 3: Update user subscription record in DB
    const updatedSubscription = await tx.userSubscription.update({
      where: {
        id: existing.id, // Use the ID from the found subscription
      },
      data: {
        // endDate remains unchanged
        paymentStatus: PaymentStatus.CANCELLED, // Mark as CANCELLED to indicate no renewal
      },
    });
    return {
      message: 'Subscription set to cancel at period end',
      subscription: updatedSubscription,
    };
  });
  return result;
};

const deleteCustomerSubscriptionItemFromDb = async (
  userId: string,
  saloonOwnerId: string,
) => {
  const result = await prisma.$transaction(async tx => {
    // Step 1: Find existing subscription
    const existing = await tx.userSubscription.findFirst({
      where: {
        userId: saloonOwnerId,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });
    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
    }

    // Step 2: Cancel Stripe subscription if exists
    if (existing.stripeSubscriptionId) {
      try {
        console.log(
          'Cancelling Stripe subscription:',
          existing.stripeSubscriptionId,
        );
        await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
        console.log(
          'Stripe subscription cancelled:',
          existing.stripeSubscriptionId,
        );
      } catch (err) {
        console.error('Error cancelling Stripe subscription:', err);
        // Don't throw - proceed with database cancellation
      }
    }
    console.log('Proceeding to cancel subscription in DB:', saloonOwnerId);
    // Step 3: Update user subscription record (soft delete)
    const updatedSubscription = await tx.userSubscription.update({
      where: {
        userId: saloonOwnerId,
        stripeSubscriptionId: existing.stripeSubscriptionId!,
      },
      data: {
        endDate: new Date(),
        paymentStatus: PaymentStatus.CANCELLED, // Use CANCELLED instead of REFUNDED
      },
    });

    console.log('Proceeding to cancel subscription in DB:', saloonOwnerId);

    // Step 4: Update related payments
    const paymentsToUpdate = await tx.payment.findMany({
      where: {
        stripeSubscriptionId: existing.stripeSubscriptionId,
        status: PaymentStatus.COMPLETED,
      },
    });

    if (paymentsToUpdate.length > 0) {
      await tx.payment.updateMany({
        where: {
          stripeSubscriptionId: existing.stripeSubscriptionId,
          status: PaymentStatus.COMPLETED,
        },
        data: {
          status: PaymentStatus.CANCELLED, // Or REFUNDED if you actually process refunds
        },
      });
    }

    // Step 5: Check if user has other active subscriptions
    // const otherActiveSubscriptions = await tx.userSubscription.findFirst({
    //   where: {
    //     userId: userId,
    //     id: { not: subscriptionOfferId }, // Exclude this subscription
    //     endDate: { gt: new Date() },
    //     paymentStatus: PaymentStatus.COMPLETED,
    //   },
    // });

    // // Step 6: Update user status if no active subscriptions remain
    // if (!otherActiveSubscriptions) {
    //   await tx.user.update({
    //     where: { id: userId },
    //     data: {
    //       isSubscribed: false,
    //       subscriptionEnd: null,
    //     },
    //   });
    // }

    return {
      message: 'Subscription cancelled successfully',
      saloonOwnerId: saloonOwnerId,
    };
  });
  return result;
};

const deleteUserSubscriptionItemFromDb = async (
  userId: string,
  subscriptionOfferId: string,
) => {
  const result = await prisma.$transaction(async tx => {
    // Step 1: Find existing subscription for THIS USER
    const existing = await tx.userSubscription.findFirst({
      where: {
        subscriptionOfferId: subscriptionOfferId,
        userId: userId, // ← CRITICAL: Add user filter
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });
    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
    }

    // Step 2: Cancel Stripe subscription if exists
    if (existing.stripeSubscriptionId) {
      try {
        console.log(
          'Cancelling Stripe subscription:',
          existing.stripeSubscriptionId,
        );

        // CANCEL IMMEDIATELY (no refund)
        // CORRECT: Use .cancel() with options to prevent refunds
        await stripe.subscriptions.cancel(existing.stripeSubscriptionId, {
          invoice_now: false, // Don't create final invoice
          prorate: false, // Don't prorate refund
        });
        console.log(
          'Stripe subscription cancelled immediately (no refund):',
          existing.stripeSubscriptionId,
        );
      } catch (err) {
        console.error('Error cancelling Stripe subscription:', err);
        // Don't throw - proceed with database cancellation
      }
    }

    // Step 3: Update user subscription record (soft delete)
    const updatedSubscription = await tx.userSubscription.update({
      where: {
        id: existing.id, // Use the ID from the found subscription
      },
      data: {
        endDate: new Date(),
        paymentStatus: PaymentStatus.CANCELLED,
      },
    });

    // Step 4: Update related payments to CANCELLED (not refunded)
    await tx.payment.updateMany({
      where: {
        stripeSubscriptionId: existing.stripeSubscriptionId,
        status: PaymentStatus.COMPLETED,
      },
      data: {
        status: PaymentStatus.CANCELLED,
      },
    });

    // Step 5: Check if user has other active subscriptions
    const otherActiveSubscriptions = await tx.userSubscription.findFirst({
      where: {
        userId: userId,
        id: { not: existing.id }, // Exclude this subscription
        endDate: { gt: new Date() },
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });

    // Step 6: Update user status if no active subscriptions remain
    if (!otherActiveSubscriptions) {
      await tx.user.update({
        where: { id: userId },
        data: {
          isSubscribed: false,
          subscriptionEnd: null,
        },
      });
    }

    return {
      message: 'Subscription cancelled successfully (no refund issued)',
      cancelledSubscriptionId: existing.id,
    };
  });
  return result;
};

const createCheckoutSessionInStripe = async (
  userId: string,
  data: {
    subscriptionOfferId: string;
    pricingRuleId?: string; // Optional pricing rule
    referralCode?: string; // Optional referral code for discount
    // successUrl: string;
    // cancelUrl: string;
  },
) => {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      trainers: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Get subscription offer
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: data.subscriptionOfferId },
  });

  if (!subscriptionOffer || !subscriptionOffer.stripePriceId) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Subscription offer not found or missing Stripe price',
    );
  }

  // Create or get Stripe customer
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullName,
      metadata: { userId: user.id },
    });
    stripeCustomerId = customer.id;

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });
  }

  // Check for referral code discount first (takes priority)
  let referralDiscount = null;
  let stripeCouponId: string | undefined = undefined;
  let discountAmount = 0;

  if (data.referralCode) {
    try {
      referralDiscount = await processReferralCodeDiscount(
        userId,
        data.referralCode,
      );
      stripeCouponId = referralDiscount.stripeCouponId;
      discountAmount = referralDiscount.discountAmount;
    } catch (error) {
      // If referral code processing fails, throw the error to the client
      throw error;
    }
  }

  // Check for applicable pricing rules (only if no referral code applied)
  let applicablePricingRule = null;

  if (!referralDiscount && data.pricingRuleId) {
    // User selected a specific pricing rule
    applicablePricingRule = await prisma.subscriptionPricingRule.findUnique({
      where: { id: data.pricingRuleId },
      include: {
        subscriptionPricingRuleTrainers: true,
      },
    });

    if (!applicablePricingRule || !applicablePricingRule.isActive) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Selected pricing rule is not valid or inactive',
      );
    }

    // Validate rule eligibility
    await validatePricingRuleEligibility(
      userId,
      applicablePricingRule,
      user.trainers?.[0]?.userId,
    );

    stripeCouponId = applicablePricingRule.stripeCouponId || undefined;
  } else if (user.trainers && user.trainers.length > 0) {
    // Auto-check for applicable rules for trainers
    const applicableRules = await getApplicablePricingRulesForUser(
      userId,
      data.subscriptionOfferId,
      user.trainers[0].userId,
    );

    if (applicableRules.length > 0) {
      // Use the best discount (first in sorted list)
      applicablePricingRule = applicableRules[0];
      stripeCouponId = applicablePricingRule.stripeCouponId || undefined;
      discountAmount = applicablePricingRule.discountAmount || 0;
    }
  }

  // Create checkout session
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: subscriptionOffer.stripePriceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
   success_url: `${config.frontend_base_url}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.frontend_base_url}/payment-cancel`,
    metadata: {
      userId: userId,
      subscriptionOfferId: data.subscriptionOfferId,
      pricingRuleId: applicablePricingRule?.id || '',
      referralId: referralDiscount?.referralId || '',
      referralCode: referralDiscount?.referralCode || '',
    },
    subscription_data: {
      metadata: {
        userId: userId,
        subscriptionOfferId: data.subscriptionOfferId,
        pricingRuleId: applicablePricingRule?.id || '',
        referralId: referralDiscount?.referralId || '',
        referralCode: referralDiscount?.referralCode || '',
      },
    },
  };

  // Apply coupon if available
  if (stripeCouponId) {
    sessionConfig.discounts = [
      {
        coupon: stripeCouponId,
      },
    ];
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);

  return {
    sessionId: session.id,
    url: session.url,
    appliedDiscount: referralDiscount
      ? {
          type: 'referral',
          code: referralDiscount.referralCode,
          discountAmount: referralDiscount.discountAmount,
          originalPrice: subscriptionOffer.price,
          discountedPrice: subscriptionOffer.price - referralDiscount.discountAmount,
        }
      : applicablePricingRule
      ? {
          type: 'pricing_rule',
          name: applicablePricingRule.name,
          discountAmount: applicablePricingRule.discountAmount,
          originalPrice: subscriptionOffer.price,
          discountedPrice: applicablePricingRule.discountAmount
            ? subscriptionOffer.price - applicablePricingRule.discountAmount
            : subscriptionOffer.price,
        }
      : null,
  };
};

// Helper function to validate pricing rule eligibility
const validatePricingRuleEligibility = async (
  userId: string,
  pricingRule: any,
  trainerId?: string,
) => {
  const now = new Date();

  // Check if user already used this rule
  const existingUsage = await prisma.subscriptionPricingUsage.findUnique({
    where: {
      pricingRuleId_userId: {
        pricingRuleId: pricingRule.id,
        userId: userId,
      },
    },
  });

  if (existingUsage) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You have already used this pricing rule',
    );
  }

  // Validate TIME_BASED rules
  if (pricingRule.type === PricingRuleType.TIME_BASED) {
    if (
      !pricingRule.startDate ||
      !pricingRule.endDate ||
      now < pricingRule.startDate ||
      now > pricingRule.endDate
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This pricing rule is not currently active',
      );
    }
  }

  // Validate FIRST_COME rules
  if (pricingRule.type === PricingRuleType.FIRST_COME) {
    if (
      pricingRule.maxSubscribers &&
      pricingRule.usageCount >= pricingRule.maxSubscribers
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This pricing rule has reached its maximum subscribers',
      );
    }
  }

  // Validate SPECIFIC_TRAINER rules
  if (pricingRule.type === PricingRuleType.SPECIFIC_TRAINER) {
    if (!trainerId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Only trainers are eligible for this pricing rule',
      );
    }

    const isEligibleTrainer = pricingRule.subscriptionPricingRuleTrainers.some(
      (t: any) => t.trainerId === trainerId,
    );

    if (!isEligibleTrainer) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not eligible for this pricing rule',
      );
    }
  }
};

// Helper function to validate and process referral code discount
const processReferralCodeDiscount = async (
  userId: string,
  referralCode: string,
) => {
  // Find the referral code
  const referral = await prisma.referral.findFirst({
    where: {
      referralCode: referralCode,
    },
    include: {
      user: true,
    },
  });

  if (!referral) {
    throw new AppError(httpStatus.NOT_FOUND, 'Invalid referral code');
  }

  // Check if user is trying to apply their own referral code
  if (referral.userId === userId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You cannot apply your own referral code',
    );
  }

  // Check if user has already applied this referral code
  const existingAppliedReferral = await prisma.appliedReferral.findFirst({
    where: {
      userId: userId,
      referralId: referral.id,
      status: AppliedReferralStatus.APPLIED,
    },
  });

  if (existingAppliedReferral) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You have already applied this referral code',
    );
  }

  // Get the referral reward amount from settings
  const referralRewardSettings = await prisma.referralRewardSettings.findFirst();
  
  if (!referralRewardSettings) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Referral reward settings not configured',
    );
  }

  // Create or get Stripe coupon for this referral
  let stripeCouponId = referral.stripeCouponId;
  
  if (!stripeCouponId) {
    // Create a new Stripe coupon for this referral code
    const coupon = await stripe.coupons.create({
      amount_off: Math.round(referralRewardSettings.rewardAmount * 100), // Convert to cents
      currency: 'usd',
      duration: 'once',
      name: `Referral Code: ${referralCode}`,
      metadata: {
        referralId: referral.id,
        referralCode: referralCode,
      },
    });

    stripeCouponId = coupon.id;

    // Update referral with Stripe coupon ID
    await prisma.referral.update({
      where: { id: referral.id },
      data: { stripeCouponId: coupon.id },
    });
  }

  return {
    referralId: referral.id,
    referralCode: referral.referralCode,
    discountAmount: referralRewardSettings.rewardAmount,
    stripeCouponId: stripeCouponId,
  };
};

// Helper function to get applicable pricing rules
const getApplicablePricingRulesForUser = async (
  userId: string,
  subscriptionOfferId: string,
  trainerId?: string,
) => {
  const now = new Date();

  const whereConditions: any[] = [
    {
      subscriptionOfferId: subscriptionOfferId,
      isActive: true,
      type: PricingRuleType.TIME_BASED,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    {
      subscriptionOfferId: subscriptionOfferId,
      isActive: true,
      type: PricingRuleType.FIRST_COME,
      OR: [
        { maxSubscribers: null },
        {
          maxSubscribers: { gt: 0 },
          usageCount: { lt: prisma.subscriptionPricingRule.fields.maxSubscribers },
        },
      ],
    },
  ];

  // Add SPECIFIC_TRAINER rules if user is a trainer
  if (trainerId) {
    whereConditions.push({
      subscriptionOfferId: subscriptionOfferId,
      isActive: true,
      type: PricingRuleType.SPECIFIC_TRAINER,
      subscriptionPricingRuleTrainers: {
        some: { trainerId: trainerId },
      },
    });
  }

  const applicableRules = await prisma.subscriptionPricingRule.findMany({
    where: {
      OR: whereConditions,
    },
    include: {
      subscriptionPricingRuleTrainers: true,
    },
    orderBy: [
      { discountAmount: 'desc' }, // Prioritize bigger discounts
    ],
  });

  // Filter out already used rules
  const usedRules = await prisma.subscriptionPricingUsage.findMany({
    where: {
      userId: userId,
      pricingRuleId: { in: applicableRules.map(r => r.id) },
    },
    select: { pricingRuleId: true },
  });

  const usedRuleIds = new Set(usedRules.map(u => u.pricingRuleId));

  return applicableRules.filter(rule => !usedRuleIds.has(rule.id));
};
const getPaymentMethodFromSession = async (sessionId: string) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['setup_intent'],
    });

    if (session.mode !== 'setup') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This session is not a setup session',
      );
    }

    const setupIntent = session.setup_intent as Stripe.SetupIntent;
    const paymentMethodId = setupIntent.payment_method as string;

    if (!paymentMethodId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payment method not found in session',
      );
    }

    return {
      paymentMethodId,
      userId: session.metadata?.userId,
      subscriptionOfferId: session.metadata?.subscriptionOfferId,
    };
  } catch (error: any) {
    if (error.type === 'StripeInvalidRequestError') {
      throw new AppError(httpStatus.NOT_FOUND, 'Session not found');
    }
    throw error;
  }
};

export const userSubscriptionService = {
  createCheckoutSessionInStripe,
  getPaymentMethodFromSession,
  createUserSubscriptionIntoDb,
  getUserSubscriptionListFromDb,
  getTrainerSubscriptionPlanFromDb,
  getUserSubscriptionByIdFromDb,
  updateUserSubscriptionIntoDb,
  cancelAutomaticRenewalIntoDb,
  deleteUserSubscriptionItemFromDb,
  deleteCustomerSubscriptionItemFromDb,
  createUserSubscriptionFromWebhook,
};

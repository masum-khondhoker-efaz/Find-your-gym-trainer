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
import { calculatePagination, formatPaginationResponse } from '../../utils/pagination';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

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
          stripeSubscriptionId: true,
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
        where: { paymentStatus: { in: [PaymentStatus.COMPLETED, PaymentStatus.CANCELLED, PaymentStatus.REFUNDED, PaymentStatus.EXPIRED] } },
      },
    },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  console.log('User subscription data:', user.userSubscriptions);
  
  // Check if user's stripeSubscriptionId exists in any of their subscriptions
  if (user.stripeSubscriptionId && !user.userSubscriptions.some(
    sub => sub.stripeSubscriptionId === user.stripeSubscriptionId,
  )) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Subscription data mismatch');
  }

  return {
    userSubscriptionId: user.userSubscriptions[0]?.id,
    subscriptionId: user.userSubscriptions[0]?.subscriptionOffer?.id,
    subscriptionPlan: user.subscriptionPlan,
    isSubscribed: user.isSubscribed,
    subscriptionStart: user.userSubscriptions[0]?.startDate,
    subscriptionEnd: user.subscriptionEnd,
    stripeSubscriptionId: user.stripeSubscriptionId,
    duration: user.userSubscriptions[0]?.subscriptionOffer?.duration,
    price: user.userSubscriptions[0]?.subscriptionOffer?.price,
    description: user.userSubscriptions[0]?.subscriptionOffer?.description,
  };
};

const getUserSubscriptionListFromDb = async (
  _userId: string,
  options: ISearchAndFilterOptions = {},
) => {
  const normalizedOptions = {
    ...options,
    page: options.page || 1,
    limit: options.limit || 10,
    sortBy: options.sortBy || 'createdAt',
    sortOrder: options.sortOrder || 'desc',
  };

  const { page, limit, skip, sortBy, sortOrder } =
    calculatePagination(normalizedOptions);

  const andConditions: Prisma.UserSubscriptionWhereInput[] = [
    // This endpoint is admin-facing list: include all users' subscription-plan records.
    { subscriptionOfferId: { isSet: true } },
    {
      OR: [{ productId: null }, { productId: { isSet: false } }],
    },
  ];

  if (options.startDate) {
    const parsedStartDate = new Date(options.startDate);
    if (!Number.isNaN(parsedStartDate.getTime())) {
      andConditions.push({
        startDate: {
          gte: parsedStartDate,
        },
      });
    }
  }

  if (options.endDate) {
    const parsedEndDate = new Date(options.endDate);
    if (!Number.isNaN(parsedEndDate.getTime())) {
      andConditions.push({
        endDate: {
          lte: parsedEndDate,
        },
      });
    }
  }

  const amountValue = options.amount ?? options.filters?.amount;
  const parsedAmount =
    amountValue !== undefined ? Number(amountValue) : undefined;
  const parsedPriceMin =
    options.priceMin !== undefined ? Number(options.priceMin) : undefined;
  const parsedPriceMax =
    options.priceMax !== undefined ? Number(options.priceMax) : undefined;

  const hasAmountFilter =
    parsedAmount !== undefined && !Number.isNaN(parsedAmount);
  const hasPriceMin =
    parsedPriceMin !== undefined && !Number.isNaN(parsedPriceMin);
  const hasPriceMax =
    parsedPriceMax !== undefined && !Number.isNaN(parsedPriceMax);

  if (hasAmountFilter || hasPriceMin || hasPriceMax) {
    const priceFilter: Prisma.FloatFilter = {};

    if (hasAmountFilter) {
      priceFilter.equals = parsedAmount;
    }

    if (hasPriceMin) {
      priceFilter.gte = parsedPriceMin;
    }

    if (hasPriceMax) {
      priceFilter.lte = parsedPriceMax;
    }

    andConditions.push({
      subscriptionOffer: {
        is: {
          price: priceFilter,
        },
      },
    });
  }

  // totalReferrals filter like price range filter
    // totalReferrals filter like price range filter
    const parsedTotalReferralsMin =
      options.totalReferralsMin !== undefined ? Number(options.totalReferralsMin) : undefined;
    const parsedTotalReferralsMax =
      options.totalReferralsMax !== undefined ? Number(options.totalReferralsMax) : undefined;

    const hasTotalReferralsMin =
      parsedTotalReferralsMin !== undefined && !Number.isNaN(parsedTotalReferralsMin);
    const hasTotalReferralsMax =
      parsedTotalReferralsMax !== undefined && !Number.isNaN(parsedTotalReferralsMax);

    if (hasTotalReferralsMin || hasTotalReferralsMax) {
      const totalReferralsFilter: Prisma.IntFilter = {};

      if (hasTotalReferralsMin) {
        totalReferralsFilter.gte = parsedTotalReferralsMin;
      }
      if (hasTotalReferralsMax) {
        totalReferralsFilter.lte = parsedTotalReferralsMax;
      }

      andConditions.push({
        user: {
          trainers: {
            some: {
              totalReferrals: totalReferralsFilter,
            },
          },
        },
      });
    }


  if (options.paymentStatus) {
    andConditions.push({
      paymentStatus: options.paymentStatus as PaymentStatus,
    });
  }

  if (options.fullName) {
    andConditions.push({
      user: {
        fullName: {
          contains: options.fullName,
          mode: 'insensitive',
        },
      },
    });
  }

  if (options.email) {
    andConditions.push({
      user: {
        email: {
          contains: options.email,
          mode: 'insensitive',
        },
      },
    });
  }

  if (options.searchTerm) {
    const searchTerm = options.searchTerm;
    const searchableFields = options.searchFields?.length
      ? options.searchFields
      : ['fullName', 'email', 'title', 'description'];

    const orConditions: Prisma.UserSubscriptionWhereInput[] = [];

    if (searchableFields.includes('fullName')) {
      orConditions.push({
        user: {
          fullName: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      });
    }

    if (searchableFields.includes('email')) {
      orConditions.push({
        user: {
          email: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      });
    }

    if (searchableFields.includes('title')) {
      orConditions.push({
        subscriptionOffer: {
          is: {
            title: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },
      });
    }

    if (searchableFields.includes('description')) {
      orConditions.push({
        subscriptionOffer: {
          is: {
            description: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },
      });
    }

    if (orConditions.length > 0) {
      andConditions.push({ OR: orConditions });
    }
  }

  const whereConditions: Prisma.UserSubscriptionWhereInput = {
    AND: andConditions,
  };

  let orderBy: Prisma.UserSubscriptionOrderByWithRelationInput = {
    createdAt: sortOrder,
  };

  if (sortBy === 'amount') {
    orderBy = {
      subscriptionOffer: {
        price: sortOrder,
      },
    };
  } else if (sortBy === 'trainerName') {
    orderBy = {
      user: {
        fullName: sortOrder,
      },
    };
  } else if (sortBy === 'email') {
    orderBy = {
      user: {
        email: sortOrder,
      },
    };
  } else if (
    ['createdAt', 'updatedAt', 'startDate', 'endDate'].includes(sortBy)
  ) {
    orderBy = {
      [sortBy]: sortOrder,
    } as Prisma.UserSubscriptionOrderByWithRelationInput;
  }

  const [result, total] = await prisma.$transaction([
    prisma.userSubscription.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy,
      include: {
        subscriptionOffer: true,
        user: {
          select: {
            fullName: true,
            image: true,
            email: true,
            trainers: {
              select: {
                totalReferrals: true,
              },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.userSubscription.count({
      where: whereConditions,
    }),
  ]);

  const now = new Date();

  const transformedResult = result.map(({ user, ...item }) => ({
    ...item,
    trainerInfo: {
      name: user.fullName,
      image: user.image,
      email: user.email,
      totalReferrals: user.trainers[0]?.totalReferrals || 0,
    },
    subscriptionState: item.endDate > now ? 'active' : 'expired',
  }));

  return formatPaginationResponse(transformedResult, total, page, limit);
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
    subscriptionOfferId: string;
    // pricingRuleId?: string; // Optional pricing rule
    // referralCode?: string; // Optional referral code for discount
  },
) => {
  // Step 1: Find existing user subscription
  const existing = await prisma.userSubscription.findFirst({
    where: {
      id: userSubscriptionId,
      userId,
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
  }

  // Check if subscription is cancelled or expired (allow renewal)
  const now = new Date();
  const isCancelled = existing.paymentStatus === PaymentStatus.CANCELLED;
  const isExpired = existing.endDate <= now;

  if (!isCancelled && !isExpired) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription is still active. Please cancel first or wait until expiration.',
    );
  }

  // Step 2: Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      trainers: true,
      userSubscriptions: true
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if(!user.userSubscriptions || user.userSubscriptions.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'No existing subscription found for user');
  }
   // Check if user's stripeSubscriptionId exists in any of their subscriptions
  if (user.stripeSubscriptionId && !user.userSubscriptions.some(
    sub => sub.stripeSubscriptionId === user.stripeSubscriptionId,
  )) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Subscription data mismatch');
  }
  // get the exact subscription that matches the userSubscriptionId
  const subscription = user.userSubscriptions.find(sub => sub.id === userSubscriptionId);

  // Step 3: Get subscription offer
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id:subscription?.subscriptionOfferId! },
  });

  if (!subscriptionOffer || !subscriptionOffer.stripePriceId) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Subscription offer not found or missing Stripe price',
    );
  }

  // Step 4: Create or get Stripe customer
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

  // Step 5: Check for referral code discount first (takes priority)
  let referralDiscount = null;
  let stripeCouponId: string | undefined = undefined;
  let discountAmount = 0;

  // if (data.referralCode) {
  //   try {
  //     referralDiscount = await processReferralCodeDiscount(
  //       userId,
  //       data.referralCode,
  //     );
  //     stripeCouponId = referralDiscount.stripeCouponId;
  //     discountAmount = referralDiscount.discountAmount;
  //   } catch (error) {
  //     throw error;
  //   }
  // }

  // Step 6: Check for applicable pricing rules (only if no referral code applied)
  // let applicablePricingRule = null;

  // if (!referralDiscount && data.pricingRuleId) {
  //   applicablePricingRule = await prisma.subscriptionPricingRule.findUnique({
  //     where: { id: data.pricingRuleId },
  //     include: {
  //       subscriptionPricingRuleTrainers: true,
  //     },
  //   });

  //   if (!applicablePricingRule || !applicablePricingRule.isActive) {
  //     throw new AppError(
  //       httpStatus.BAD_REQUEST,
  //       'Selected pricing rule is not valid or inactive',
  //     );
  //   }

  //   await validatePricingRuleEligibility(
  //     userId,
  //     applicablePricingRule,
  //     user.trainers?.[0]?.userId,
  //   );

  //   stripeCouponId = applicablePricingRule.stripeCouponId || undefined;
  // } else if (user.trainers && user.trainers.length > 0 && !referralDiscount) {
  //   const applicableRules = await getApplicablePricingRulesForUser(
  //     userId,
  //     data.subscriptionOfferId,
  //     user.trainers[0].userId,
  //   );

  //   if (applicableRules.length > 0) {
  //     applicablePricingRule = applicableRules[0];
  //     stripeCouponId = applicablePricingRule.stripeCouponId || undefined;
  //     discountAmount = applicablePricingRule.discountAmount || 0;
  //   }
  // }

  // Step 7: Create checkout session for renewal
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
      userSubscriptionId: userSubscriptionId, // Track which subscription to update
      isRenewal: 'true', // Flag to indicate this is a renewal
      // pricingRuleId: applicablePricingRule?.id || '',
      // referralId: referralDiscount?.referralId || '',
      // referralCode: referralDiscount?.referralCode || '',
    },
    subscription_data: {
      metadata: {
        userId: userId,
        subscriptionOfferId: data.subscriptionOfferId,
        userSubscriptionId: userSubscriptionId,
        isRenewal: 'true',
        // pricingRuleId: applicablePricingRule?.id || '',
        // referralId: referralDiscount?.referralId || '',
        // referralCode: referralDiscount?.referralCode || '',
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
    message: 'Checkout session created for subscription renewal',
    // appliedDiscount: referralDiscount
    //   ? {
    //       type: 'referral',
    //       code: referralDiscount.referralCode,
    //       discountAmount: referralDiscount.discountAmount,
    //       originalPrice: subscriptionOffer.price,
    //       discountedPrice: subscriptionOffer.price - referralDiscount.discountAmount,
    //     }
    //   : applicablePricingRule
    //   ? {
    //       type: 'pricing_rule',
    //       name: applicablePricingRule.name,
    //       discountAmount: applicablePricingRule.discountAmount,
    //       originalPrice: subscriptionOffer.price,
    //       discountedPrice: applicablePricingRule.discountAmount
    //         ? subscriptionOffer.price - applicablePricingRule.discountAmount
    //         : subscriptionOffer.price,
    //     }
    //   : null,
  };
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

  // Process referral code discount if provided by user
  let referralDiscount = null;
  if (data.referralCode) {
    try {
      referralDiscount = await processReferralCodeDiscount(
        userId,
        data.referralCode,
      );
    } catch (error) {
      // If referral code processing fails, throw the error to the client
      throw error;
    }
  }

  // Auto-detect the currently active pricing rule (always check)
  let applicablePricingRule = null;
  
  // Get the best applicable pricing rule for this user
  if (user.trainers && user.trainers.length > 0) {
    const applicableRules = await getApplicablePricingRulesForUser(
      userId,
      data.subscriptionOfferId,
      user.trainers[0].userId,
    );

    if (applicableRules.length > 0) {
      // Use the best/first active pricing rule
      applicablePricingRule = applicableRules[0];
    }
  }

  // Combine discounts: calculate total savings
  let totalDiscountAmount = 0;
  let stripeCouponId: string | undefined = undefined;

  const referralDiscountAmount = referralDiscount?.discountAmount || 0;
  const pricingRuleDiscountAmount = applicablePricingRule?.discountAmount || 0;
  totalDiscountAmount = referralDiscountAmount + pricingRuleDiscountAmount;

  // Apply combined discount if both exist
  if (referralDiscount && applicablePricingRule && totalDiscountAmount > 0) {
    // Create a single combined coupon with total discount
    try {
      const combinedCoupon = await stripe.coupons.create({
        amount_off: Math.round(totalDiscountAmount * 100), // Convert to cents
        currency: 'usd',
        name: `Combined: Referral + Vitakinetic offer`,
        duration: 'repeating',
        duration_in_months: 1, // Apply for first billing cycle only
      });
      stripeCouponId = combinedCoupon.id;
    } catch (error: any) {
      console.error('Combined coupon creation failed:', error.message);
      // If combined coupon creation fails, use referral only as fallback
      stripeCouponId = referralDiscount.stripeCouponId;
    }
  } else if (referralDiscount?.stripeCouponId) {
    // Only referral discount
    stripeCouponId = referralDiscount.stripeCouponId;
  } else if (applicablePricingRule?.stripeCouponId) {
    // Only pricing rule discount
    stripeCouponId = applicablePricingRule.stripeCouponId;
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
      totalDiscountApplied: totalDiscountAmount.toString(),
    },
    subscription_data: {
      metadata: {
        userId: userId,
        subscriptionOfferId: data.subscriptionOfferId,
        pricingRuleId: applicablePricingRule?.id || '',
        referralId: referralDiscount?.referralId || '',
        referralCode: referralDiscount?.referralCode || '',
        totalDiscountApplied: totalDiscountAmount.toString(),
      },
    },
  };

  // Apply discount coupon if available
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
    appliedDiscount:
      referralDiscount && applicablePricingRule
        ? {
            type: 'combined',
            referral: {
              code: referralDiscount.referralCode,
              discountAmount: referralDiscount.discountAmount,
            },
            pricingRule: {
              name: applicablePricingRule.name,
              discountAmount: applicablePricingRule.discountAmount,
            },
            totalDiscountAmount: totalDiscountAmount,
            originalPrice: subscriptionOffer.price,
            finalPrice: Math.max(0, subscriptionOffer.price - totalDiscountAmount),
          }
        : referralDiscount
        ? {
            type: 'referral',
            code: referralDiscount.referralCode,
            discountAmount: referralDiscount.discountAmount,
            originalPrice: subscriptionOffer.price,
            finalPrice: subscriptionOffer.price - referralDiscount.discountAmount,
          }
        : applicablePricingRule
        ? {
            type: 'Vitakinetic offer',
            name: applicablePricingRule.name,
            discountAmount: applicablePricingRule.discountAmount,
            originalPrice: subscriptionOffer.price,
            finalPrice: Math.max(
              0,
              subscriptionOffer.price - (applicablePricingRule.discountAmount || 0),
            ),
          }
        : null,
  };
};

// Helper function to get the currently active pricing rule
const getActiveSubscriptionPricingRule = async (
  subscriptionOfferId: string,
): Promise<any | null> => {
  const now = new Date();

  // Find the most recently active pricing rule that's currently valid
  const activeRule = await prisma.subscriptionPricingRule.findFirst({
    where: {
      subscriptionOfferId: subscriptionOfferId,
      isActive: true,
      OR: [
        // TIME_BASED rules that are currently within their date range
        {
          type: PricingRuleType.TIME_BASED,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        // FIRST_COME rules with available slots
        {
          type: PricingRuleType.FIRST_COME,
          maxSubscribers: {
            gt: prisma.subscriptionPricingRule.fields.usageCount,
          },
        },
        // REFERRAL rules
        {
          type: PricingRuleType.REFERRAL,
        },
      ],
    },
    orderBy: [
      { discountAmount: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 1,
  });

  return activeRule;
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

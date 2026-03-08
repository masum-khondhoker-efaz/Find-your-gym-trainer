import prisma from '../../utils/prisma';
import { OrderState, OrderStatus, PaymentStatus, ProductStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import Stripe from 'stripe';
import config from '../../../config';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination, formatPaginationResponse } from '../../utils/pagination';

const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

const createOrdersIntoDb = async (
  userId: string,
  payload: {
    productId: string;
    trainerId?: string;
  },
) => {
  const { productId, trainerId } = payload;

  return await prisma.$transaction(async (tx) => {
    // Validate product exists and is active
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        productName: true,
        price: true,
        isActive: true,
        status: true,
        capacity: true,
        totalPurchased: true,
        userId: true,
        durationWeeks: true,
        invoiceFrequency: true,
        productImage: true,
      },
    });

    if (!product) {
      throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
    }

    if (!product.isActive || product.status !== ProductStatus.ACTIVE) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Product is not available for purchase');
    }

    // Check capacity if applicable
    if (product.capacity && product.totalPurchased >= product.capacity) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Product capacity reached');
    }

    // Validate trainer if provided
    if (trainerId) {
      const trainer = await tx.trainer.findUnique({
        where: { userId: trainerId },
      });

      if (!trainer) {
        throw new AppError(httpStatus.NOT_FOUND, 'Trainer not found');
      }
    }

    // Get customer info
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        fullName: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Check for active custom pricing
    const now = new Date();
    const activeCustomPricing = await tx.customPricing.findFirst({
      where: {
        productId: productId,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: {
        customPrice: 'asc',
      },
    });

    // Calculate pricing
    let finalPrice = product.price;
    let customPricingId = null;
    let discountAmount = 0;

    if (activeCustomPricing) {
      // Check if custom pricing limit is reached
      const customPricingUsageCount = await tx.order.count({
        where: {
          customPricingId: activeCustomPricing.id,
          paymentStatus: { in: [PaymentStatus.COMPLETED, PaymentStatus.PENDING] },
        },
      });

      if (customPricingUsageCount < activeCustomPricing.limit) {
        finalPrice = activeCustomPricing.customPrice;
        customPricingId = activeCustomPricing.id;
        discountAmount = product.price - activeCustomPricing.customPrice;
      }
    }

    // Ensure Stripe Customer exists
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const stripeCustomer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.fullName,
      });

      await tx.user.update({
        where: { id: userId },
        data: { stripeCustomerId: stripeCustomer.id },
      });

      customerId = stripeCustomer.id;
    }

    // Determine if this is a subscription or one-time payment
    const isSubscription = product.invoiceFrequency !== 'ONE_TIME';
    let session;
    let nextBillingDate = null;

    if (isSubscription) {
      // Create recurring subscription
      const interval = product.invoiceFrequency === 'WEEKLY' ? 'week' 
        : product.invoiceFrequency === 'MONTHLY' ? 'month'
        : 'year';

      // Calculate next billing date
      nextBillingDate = new Date();
      if (product.invoiceFrequency === 'WEEKLY') {
        nextBillingDate.setDate(nextBillingDate.getDate() + 7);
      } else if (product.invoiceFrequency === 'MONTHLY') {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      } else {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      }

      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: product.productName,
                description: `${product.durationWeeks} weeks program - ${product.invoiceFrequency} billing`,
                images: product.productImage ? [product.productImage] : [],
              },
              unit_amount: Math.round(finalPrice * 100),
              recurring: {
                interval: interval as 'week' | 'month' | 'year',
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${config.frontend_base_url}/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontend_base_url}/order-cancel`,
        metadata: {
          userId,
          productId,
          trainerId: product.userId || trainerId || '',
          customPricingId: customPricingId || '',
          orderType: 'subscription',
        },
      });
    } else {
      // Create one-time payment
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        payment_intent_data: {
          metadata: {
            userId,
            userName: user.fullName,
            productId,
            productName: product.productName,
            trainerId: product.userId || trainerId || '',
            customPricingId: customPricingId || '',
            orderType: 'one_time',
          },
        },
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: product.productName,
                description: `${product.durationWeeks} weeks program - One-time payment`,
                images: product.productImage ? [product.productImage] : [],
              },
              unit_amount: Math.round(finalPrice * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${config.frontend_base_url}/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontend_base_url}/order-cancel`,
        metadata: {
          userId,
          productId,
          trainerId: product.userId || trainerId || '',
          customPricingId: customPricingId || '',
          orderType: 'one_time',
        },
      });
    }

    // Create order in database
    const order = await tx.order.create({
      data: {
        userId,
        productId,
        trainerId: product.userId || trainerId || null,
        customPricingId,
        totalPrice: finalPrice,
        originalPrice: product.price,
        discountAmount,
        durationWeeks: product.durationWeeks,
        invoiceFrequency: product.invoiceFrequency,
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.PENDING,
        // invoice: session.url || undefined,
        nextBillingDate,
      },
    });

    return {
      orderId: order.id,
      redirectUrl: session.url,
      sessionId: session.id,
      isSubscription,
      totalPrice: finalPrice,
      originalPrice: product.price,
      discountAmount,
      message: isSubscription 
        ? `Subscription order created. You will be charged $${finalPrice} ${product.invoiceFrequency.toLowerCase()}.`
        : 'One-time payment order created.',
    };
  });
};

const getOrdersListFromDb = async (userId: string, role?: string, options?: ISearchAndFilterOptions) => {
  // Check if admin
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  // Calculate pagination
  const paginationOptions = calculatePagination({
    page: options?.page || 1,
    limit: options?.limit || 10,
    sortBy: options?.sortBy || 'createdAt',
    sortOrder: options?.sortOrder || 'desc',
  });

  // Build where conditions
  const whereConditions: any = isAdmin ? {} : { userId };

  // Add status filter
  if (options?.orderStatus) {
    whereConditions.status = options.orderStatus as OrderStatus;
  }

  // Add currentState filter
  if (options?.currentState) {
    whereConditions.currentState = options.currentState as OrderState;
  }

  // Add payment status filter
  if (options?.paymentStatus) {
    whereConditions.paymentStatus = options.paymentStatus as PaymentStatus;
  }

  // Add search term for order-related fields
  if (options?.searchTerm) {
    whereConditions.OR = [
      {
        product: {
          productName: {
            contains: options.searchTerm,
            mode: 'insensitive',
          },
        },
      },
      {
        user: {
          fullName: {
            contains: options.searchTerm,
            mode: 'insensitive',
          },
        },
      },
      {
        user: {
          email: {
            contains: options.searchTerm,
            mode: 'insensitive',
          },
        },
      },
    ];
  }

  // Get total count
  const total = await prisma.order.count({
    where: whereConditions,
  });

  // Fetch paginated results
  const result = await prisma.order.findMany({
    where: whereConditions,
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          productImage: true,
          price: true,
        },
      },
      // user: {
      //   select: {
      //     id: true,
      //     fullName: true,
      //     email: true,
      //   },
      // },
      trainer: {
        select: {
          userId: true,
          user: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      [paginationOptions.sortBy]: paginationOptions.sortOrder,
    },
    skip: paginationOptions.skip,
    take: paginationOptions.limit,
  });

  const flattenedResult = result.map((order) => ({
    ...order,
    trainer: order.trainer ? {
      userId: order.trainer.userId,
      trainerName: order.trainer.user?.fullName,
      trainerEmail: order.trainer.user?.email,
    } : null,
  }));

  if (flattenedResult.length === 0) {
    return formatPaginationResponse([], total, paginationOptions.page, paginationOptions.limit);
  }

  return formatPaginationResponse(flattenedResult, total, paginationOptions.page, paginationOptions.limit);
};

const getOrdersByIdFromDb = async (userId: string, orderId: string, role?: string) => {
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const result = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...(isAdmin ? {} : { userId }),
    },
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          productImage: true,
          productVideo: true,
          price: true,
          description: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      },
      trainer: {
        select: {
          userId: true,
          user: {
            select: {
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }

  return result;
};

const updateOrdersIntoDb = async (
  userId: string,
  orderId: string,
  data: {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
  },
  role?: string,
) => {
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  // Only admins can update orders
  if (!isAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized to update orders');
  }

  const result = await prisma.order.update({
    where: {
      id: orderId,
    },
    data: {
      ...data,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Order not updated');
  }

  return result;
};

const deleteOrdersItemFromDb = async (userId: string, orderId: string, role?: string) => {
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  if (!isAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized to delete orders');
  }

  const deletedItem = await prisma.order.delete({
    where: {
      id: orderId,
    },
  });

  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Order not deleted');
  }

  return deletedItem;
};

const getOrdersListFromDbb = async (userId: string, role?: string) => {
  // Check if admin
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const result = await prisma.order.findMany({
    where: isAdmin ? {} : { userId },
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          productImage: true,
          price: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      trainer: {
        select: {
          userId: true,
          user: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (result.length === 0) {
    return { message: 'No orders found' };
  }

  return result;
};

const getOrdersByIdFromDba = async (userId: string, orderId: string, role?: string) => {
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const result = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...(isAdmin ? {} : { userId }),
    },
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          productImage: true,
          productVideo: true,
          price: true,
          description: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      },
      trainer: {
        select: {
          userId: true,
          user: {
            select: {
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }

  return result;
};

export const ordersService = {
  createOrdersIntoDb,
  getOrdersListFromDb,
  getOrdersByIdFromDb,
  updateOrdersIntoDb,
  deleteOrdersItemFromDb,
};
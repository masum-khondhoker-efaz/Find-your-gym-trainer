import prisma from '../../utils/prisma';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import Stripe from 'stripe';
import config from '../../../config';

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
        discount: true,
        isActive: true,
        capacity: true,
        totalPurchased: true,
        userId: true,
      },
    });

    if (!product) {
      throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
    }

    if (!product.isActive) {
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

    // Calculate final price with discount
    const originalPrice = product.price;
    const discountPercent = product.discount || 0;
    const discountedPrice = originalPrice - (originalPrice * discountPercent) / 100;
    const totalPrice = discountedPrice;

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

    // Create order in database
    const order = await tx.order.create({
      data: {
        userId,
        productId,
        trainerId,
        totalPrice,
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.PENDING,
      },
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_intent_data: {
        metadata: {
          userId: userId,
          userName: user.fullName,
          orderId: order.id,
          productId: productId,
          productName: product.productName,
          trainerId: trainerId || '',
        },
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.productName,
              description: `${product.productName} - ${product.userId}`,
            },
            unit_amount: Math.round(totalPrice * 100),
          },
          quantity: 1,
        },
      ],
      customer: customerId,
      success_url: `${config.frontend_base_url}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontend_base_url}/order-cancel`,
      metadata: {
        userId,
        orderId: order.id,
        productId,
        trainerId: trainerId || '',
      },
    });

    // Store session info in order
    await tx.order.update({
      where: { id: order.id },
      data: {
        invoice: session.url || undefined,
      },
    });

    return {
      orderId: order.id,
      redirectUrl: session.url,
      sessionId: session.id,
    };
  });
};

const getOrdersListFromDb = async (userId: string, role?: string) => {
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
          discount: true,
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
          discount: true,
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
          discount: true,
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
          discount: true,
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
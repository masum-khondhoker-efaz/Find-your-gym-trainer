import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createPaymentIntoDb = async (userId: string, data: any) => {
  const result = await prisma.payment.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'payment not created');
  }
  return result;
};

// Step 2: Authorize the Payment Using Saved Card

const authorizePaymentWithStripeCheckout = async (
  userId: string,
  payload: {
    checkoutId: string;
  },
) => {
  const { checkoutId } = payload;

  // Retrieve customer info
  const customerDetails = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      stripeCustomerId: true,
    },
  });

  if (!customerDetails) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Customer not found');
  }
  //checkout exists and belongs to user
  const findCheckout = await prisma.checkout.findFirst({
    where: {
      id: checkoutId,
      userId: userId,
      status: CheckoutStatus.PENDING,
    },
    include: {
      items: {
        select: {
          id: true,
          quantity: true,
          shippingOptionId: true,
          shippingCost: true,
          shippingCarrier: true,
          estimatedDelivery: true,
          product: {
            select: {
              productName: true,
              id: true,
              price: true,
              discount: true,
            },
          },
        },
      },
      user: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });

  if (!findCheckout) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Checkout not found or already paid',
    );
  }

  // CRITICAL: Validate all items have shipping selected
  const itemsWithoutShipping = findCheckout.items.filter(
    item => !item.shippingOptionId || !item.shippingCost,
  );

  if (itemsWithoutShipping.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'All items must have shipping selected before payment. Please select shipping options first.',
    );
  }

  const totalQuantity = findCheckout.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  if (totalQuantity <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No items in the checkout to process payment',
    );
  }

  // Ensure Stripe Customer exists
  let customerId = customerDetails.stripeCustomerId;
  if (!customerId) {
    const stripeCustomer = await stripe.customers.create({
      email: customerDetails.email ?? undefined,
    });

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: stripeCustomer.id },
    });

    customerId = stripeCustomer.id;
  }

  // Calculate total amount (all items × their quantities) with discount applied
  const totalProductAmount = findCheckout.items.reduce((sum, item) => {
    const originalPrice = item.product.price;
    const discountPercent = item.product.discount || 0;
    const discountedPrice =
      originalPrice - (originalPrice * discountPercent) / 100;
    return sum + discountedPrice * item.quantity;
  }, 0);

  // Calculate total shipping cost
  const totalShippingCost = findCheckout.items.reduce(
    (sum, item) => sum + (item.shippingCost || 0),
    0,
  );

  // Create Stripe Checkout Session (supports Card)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_intent_data: {
      metadata: {
        userId: String(userId),
        userName: String(findCheckout.user?.fullName),
        checkoutId: String(checkoutId),
        productNames: findCheckout.items
          .map(item => item.product.productName)
          .join(', '),
      },
    },
    line_items: [
      {
        price_data: {
          currency: 'dzd',
          product_data: {
            name: `Products: ${findCheckout.items.map(item => item.product.productName).join(', ')}`,
            description: `Purchased products: ${findCheckout.items
              .map(item => `${item.product.productName} (x${item.quantity})`)
              .join(', ')}`,
          },
          unit_amount: Math.round(totalProductAmount * 100), // Total price in cents
        },
        quantity: 1, // Since unit_amount already includes all items, quantity is 1
      },
      {
        price_data: {
          currency: 'dzd',
          product_data: {
            name: 'Shipping',
            description: `Shipping for all items: ${findCheckout.items
              .map(
                item =>
                  `${item.product.productName} - ${item.shippingCarrier} (${item.estimatedDelivery})`,
              )
              .join(', ')}`,
          },
          unit_amount: Math.round(totalShippingCost * 100),
        },
        quantity: 1,
      },
    ],
    payment_method_types: ['card'], // Add available methods
    // Note: Older versions may not support 'apple_pay' and 'google_pay' directly
    customer: customerId,
    success_url: `${config.frontend_base_url}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.frontend_base_url}/payment-cancel`,
    metadata: {
      userId,
      checkoutId,
      productName: findCheckout.items
        .map(item => item.product.productName)
        .join(', '),
    },
  });

  // existing payment intent
  // const existingPayment = await prisma.payment.findFirst({
  //   where: {
  //     userId,
  //     checkoutId,
  //     status: PaymentStatus.PENDING,
  //   },
  // });

  // if (existingPayment) {
  //   // update payment intent id
  //   await prisma.payment.update({
  //     where: {
  //       id: existingPayment.id,
  //     },
  //     data: {
  //       amountProvider: session.customer as string,
  //     },
  //   });
  //   return { redirectUrl: session.url };
  // }

  // //create payment record in db with pending status
  // const payment = await prisma.payment.create({
  //   data: {
  //     userId,
  //     checkoutId,
  //     paymentAmount: findCheckout.totalAmount,
  //     status: PaymentStatus.PENDING,
  //     amountProvider: session.customer as string,
  //   },
  // });
  // if(!payment) {
  //   throw new AppError(httpStatus.BAD_REQUEST, 'Payment creation failed');
  // }

  // Return URL to redirect user to Stripe-hosted payment page
  return { redirectUrl: session.url };
};

// Step 3: Capture the Payment
const capturePaymentRequestToStripe = async (payload: {
  paymentIntentId: string;
}) => {
  try {
    const { paymentIntentId } = payload;

    // Capture the authorized payment using the PaymentIntent ID
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    return paymentIntent;
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

const getPaymentListFromDb = async (userId: string) => {
  const result = await prisma.payment.findMany();
  if (result.length === 0) {
    return { message: 'No payment found' };
  }
  return result;
};

const getPaymentByIdFromDb = async (userId: string, paymentId: string) => {
  const result = await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'payment not found');
  }
  return result;
};

const updatePaymentIntoDb = async (
  userId: string,
  paymentId: string,
  data: any,
) => {
  const result = await prisma.payment.update({
    where: {
      id: paymentId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'paymentId, not updated');
  }
  return result;
};

const deletePaymentItemFromDb = async (userId: string, paymentId: string) => {
  const deletedItem = await prisma.payment.delete({
    where: {
      id: paymentId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'paymentId, not deleted');
  }

  return deletedItem;
};

export const paymentService = {
  createPaymentIntoDb,
  authorizePaymentWithStripeCheckout,
  capturePaymentRequestToStripe,
  getPaymentListFromDb,
  getPaymentByIdFromDb,
  updatePaymentIntoDb,
  deletePaymentItemFromDb,
};

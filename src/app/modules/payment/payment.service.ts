import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import config from '../../../config';
import Stripe from 'stripe';

const stripe = new Stripe(config  .stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});
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

// const authorizePaymentWithStripeCheckout = async (
//   userId: string,
//   payload: {
//     checkoutId: string;
//   },
// ) => {
//   const { checkoutId } = payload;

//   // Retrieve customer info
//   const customerDetails = await prisma.user.findUnique({
//     where: { id: userId },
//     select: {
//       email: true,
//       stripeCustomerId: true,
//     },
//   });

//   if (!customerDetails) {
//     throw new AppError(httpStatus.BAD_REQUEST, 'Customer not found');
//   }
//   //checkout exists and belongs to user
//   const findCheckout = await prisma.checkout.findFirst({
//     where: {
//       id: checkoutId,
//       userId: userId,
//       status: CheckoutStatus.PENDING,
//     },
//     include: {
//       items: {
//         select: {
//           id: true,
//           quantity: true,
//           shippingOptionId: true,
//           shippingCost: true,
//           shippingCarrier: true,
//           estimatedDelivery: true,
//           product: {
//             select: {
//               productName: true,
//               id: true,
//               price: true,
//               discount: true,
//             },
//           },
//         },
//       },
//       user: {
//         select: {
//           fullName: true,
//           email: true,
//         },
//       },
//     },
//   });

//   if (!findCheckout) {
//     throw new AppError(
//       httpStatus.NOT_FOUND,
//       'Checkout not found or already paid',
//     );
//   }

//   // CRITICAL: Validate all items have shipping selected
//   const itemsWithoutShipping = findCheckout.items.filter(
//     item => !item.shippingOptionId || !item.shippingCost,
//   );

//   if (itemsWithoutShipping.length > 0) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       'All items must have shipping selected before payment. Please select shipping options first.',
//     );
//   }

//   const totalQuantity = findCheckout.items.reduce(
//     (sum, item) => sum + item.quantity,
//     0,
//   );

//   if (totalQuantity <= 0) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       'No items in the checkout to process payment',
//     );
//   }

//   // Ensure Stripe Customer exists
//   let customerId = customerDetails.stripeCustomerId;
//   if (!customerId) {
//     const stripeCustomer = await stripe.customers.create({
//       email: customerDetails.email ?? undefined,
//     });

//     await prisma.user.update({
//       where: { id: userId },
//       data: { stripeCustomerId: stripeCustomer.id },
//     });

//     customerId = stripeCustomer.id;
//   }

//   // Calculate total amount (all items × their quantities) with discount applied
//   const totalProductAmount = findCheckout.items.reduce((sum, item) => {
//     const originalPrice = item.product.price;
//     const discountPercent = item.product.discount || 0;
//     const discountedPrice =
//       originalPrice - (originalPrice * discountPercent) / 100;
//     return sum + discountedPrice * item.quantity;
//   }, 0);

//   // Calculate total shipping cost
//   const totalShippingCost = findCheckout.items.reduce(
//     (sum, item) => sum + (item.shippingCost || 0),
//     0,
//   );

//   // Create Stripe Checkout Session (supports Card)
//   const session = await stripe.checkout.sessions.create({
//     mode: 'payment',
//     payment_intent_data: {
//       metadata: {
//         userId: String(userId),
//         userName: String(findCheckout.user?.fullName),
//         checkoutId: String(checkoutId),
//         productNames: findCheckout.items
//           .map(item => item.product.productName)
//           .join(', '),
//       },
//     },
//     line_items: [
//       {
//         price_data: {
//           currency: 'dzd',
//           product_data: {
//             name: `Products: ${findCheckout.items.map(item => item.product.productName).join(', ')}`,
//             description: `Purchased products: ${findCheckout.items
//               .map(item => `${item.product.productName} (x${item.quantity})`)
//               .join(', ')}`,
//           },
//           unit_amount: Math.round(totalProductAmount * 100), // Total price in cents
//         },
//         quantity: 1, // Since unit_amount already includes all items, quantity is 1
//       },
//       {
//         price_data: {
//           currency: 'dzd',
//           product_data: {
//             name: 'Shipping',
//             description: `Shipping for all items: ${findCheckout.items
//               .map(
//                 item =>
//                   `${item.product.productName} - ${item.shippingCarrier} (${item.estimatedDelivery})`,
//               )
//               .join(', ')}`,
//           },
//           unit_amount: Math.round(totalShippingCost * 100),
//         },
//         quantity: 1,
//       },
//     ],
//     payment_method_types: ['card'], // Add available methods
//     // Note: Older versions may not support 'apple_pay' and 'google_pay' directly
//     customer: customerId,
//     success_url: `${config.frontend_base_url}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${config.frontend_base_url}/payment-cancel`,
//     metadata: {
//       userId,
//       checkoutId,
//       productName: findCheckout.items
//         .map(item => item.product.productName)
//         .join(', '),
//     },
//   });

//   // existing payment intent
//   // const existingPayment = await prisma.payment.findFirst({
//   //   where: {
//   //     userId,
//   //     checkoutId,
//   //     status: PaymentStatus.PENDING,
//   //   },
//   // });

//   // if (existingPayment) {
//   //   // update payment intent id
//   //   await prisma.payment.update({
//   //     where: {
//   //       id: existingPayment.id,
//   //     },
//   //     data: {
//   //       amountProvider: session.customer as string,
//   //     },
//   //   });
//   //   return { redirectUrl: session.url };
//   // }

//   // //create payment record in db with pending status
//   // const payment = await prisma.payment.create({
//   //   data: {
//   //     userId,
//   //     checkoutId,
//   //     paymentAmount: findCheckout.totalAmount,
//   //     status: PaymentStatus.PENDING,
//   //     amountProvider: session.customer as string,
//   //   },
//   // });
//   // if(!payment) {
//   //   throw new AppError(httpStatus.BAD_REQUEST, 'Payment creation failed');
//   // }

//   // Return URL to redirect user to Stripe-hosted payment page
//   return { redirectUrl: session.url };
// };

// Step 3: Capture the Payment
// const capturePaymentRequestToStripe = async (payload: {
//   paymentIntentId: string;
// }) => {
//   try {
//     const { paymentIntentId } = payload;

//     // Capture the authorized payment using the PaymentIntent ID
//     const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

//     return paymentIntent;
//   } catch (error: any) {
//     throw new AppError(httpStatus.CONFLICT, error.message);
//   }
// };

const cancelPaymentRequestToStripe = async (
  userId: string,
  payload: {
    bookingId: string;
  },
) => {
  const { bookingId } = payload;
  return await prisma.$transaction(async tx => {
    const findBooking = await tx.order.findUnique({
      where: {
        id: bookingId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            address: true,
            stripeCustomerId: true,
          },
        },
      },
    });
    if (!findBooking) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking not found');
    }
    
    return findBooking;
    
  });
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

const createAccountIntoStripe = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (userData.stripeAccountUrl && userData.stripeCustomerId) {
    const stripeAccountId = userData.stripeCustomerId;
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${config.backend_base_url}/reauthenticate`,
      return_url: `${config.backend_base_url}/onboarding-success`,
      type: 'account_onboarding',
    });

    await prisma.user.update({
      where: { id: userData.id },
      data: {
        stripeAccountUrl: accountLink.url,
      },
    });

    return accountLink;
  }

  // Create a Stripe Connect account
  const stripeAccount = await stripe.accounts.create({
    type: 'express',
    email: userData.email,
    metadata: {
      userId: userData.id,
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Generate the onboarding link for the Stripe Express account
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccount.id,
    refresh_url: `${config.frontend_base_url}/reauthenticate`,
    return_url: `${config.frontend_base_url}/onboarding-success`,
    type: 'account_onboarding',
  });

  const stripeAccountId = stripeAccount.id;

  // Save both Stripe customerId and accountId in the database
  const updateUser = await prisma.user.update({
    where: { id: userData.id },
    data: {
      stripeAccountUrl: accountLink.url,
      stripeAccountId: stripeAccountId,
    },
  });

  if (!updateUser) {
    throw new AppError(httpStatus.CONFLICT, 'Failed to save account details');
  }

  return accountLink;
};

const createNewAccountIntoStripe = async (userId: string) => {
  // Fetch user data from the database
  const userData = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  let stripeAccountId = userData.stripeAccountId;

  // If the user already has a Stripe account, delete it
  if (stripeAccountId) {
    await stripe.accounts.del(stripeAccountId); // Delete the old account
  }

  // Create a new Stripe account
  const newAccount = await stripe.accounts.create({
    type: 'express',
    email: userData.email, // Use the user's email from the database
    country: 'US', // Set the country dynamically if needed
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      userId: userData.id, // Add metadata for reference
    },
  });

  // Generate the onboarding link for the new Stripe account
  const accountLink = await stripe.accountLinks.create({
    account: newAccount.id,
    refresh_url: `${config.frontend_base_url}/reauthenticate`,
    return_url: `${config.frontend_base_url}/onboarding-success`,
    type: 'account_onboarding',
  });

  // Update the user's Stripe account ID and URL in the database
  await prisma.user.update({
    where: { id: userData.id },
    data: {
      stripeAccountId: newAccount.id,
      stripeAccountUrl: accountLink.url,
    },
  });

  return accountLink;
};

export const paymentService = {
  createPaymentIntoDb,
  // authorizePaymentWithStripeCheckout,
  // capturePaymentRequestToStripe,
  getPaymentListFromDb,
  getPaymentByIdFromDb,
  updatePaymentIntoDb,
  deletePaymentItemFromDb,
  createAccountIntoStripe,
  createNewAccountIntoStripe,
  cancelPaymentRequestToStripe
};

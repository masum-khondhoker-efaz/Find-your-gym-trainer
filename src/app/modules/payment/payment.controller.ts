import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { paymentService } from './payment.service';
import Stripe from 'stripe';
import config from '../../../config';
import prisma from '../../utils/prisma';
import { PaymentStatus, SubscriptionPlanStatus } from '@prisma/client';
import emailSender from '../../utils/emailSender';
import AppError from '../../errors/AppError';
import { userSubscriptionService } from '../userSubscription/userSubscription.service';

// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

const createPayment = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.createPaymentIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Payment created successfully',
    data: result,
  });
});

// Authorize the customer with the amount and send payment request
const authorizedPaymentWithSaveCard = catchAsync(async (req: any, res: any) => {
  const user = req.user as any;
  // console.log(user)
  const result = await paymentService.authorizePaymentWithStripeCheckout(
    user.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Authorized customer and payment request successfully',
    data: result,
  });
});

// Capture the payment request and deduct the amount
const capturePaymentRequest = catchAsync(async (req: any, res: any) => {
  const result = await paymentService.capturePaymentRequestToStripe(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Capture payment request and payment deduct successfully',
    data: result,
  });
});

const getPaymentList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.getPaymentListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment list retrieved successfully',
    data: result,
  });
});

const getPaymentById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.getPaymentByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment details retrieved successfully',
    data: result,
  });
});

const updatePayment = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.updatePaymentIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment updated successfully',
    data: result,
  });
});

const deletePayment = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.deletePaymentItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment deleted successfully',
    data: result,
  });
});


// ...existing code (createPayment, getPaymentList, etc.)...

const handleWebHook = catchAsync(async (req: any, res: any) => {
  const sig = req.headers['stripe-signature'] as string;
  console.log(sig);

  if (!sig) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Missing Stripe signature header.',
      data: null,
    });
  }

  let event: Stripe.Event;

  try {
    event = Stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.stripe_webhook_secret as string,
    );
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return res.status(400).send('Webhook Error');
  }

  // Handle the event types
  switch (event.type) {
    case 'account.updated':
      const account = event.data.object;
      console.log(account, 'check account from webhook');

      if (
        account.charges_enabled &&
        account.details_submitted &&
        account.payouts_enabled
      ) {
        console.log(
          'Onboarding completed successfully for account:',
          account.id,
        );
        const user = await prisma.user.update({
          where: {
            id: account.metadata?.userId,
            email: account.email!,
          },
          data: {
            onBoarding: true,
          },
        });
        if (!user) {
          return sendResponse(res, {
            statusCode: httpStatus.NOT_FOUND,
            success: false,
            message: 'User not found',
            data: null,
          });
        }
        if (user) {
          await prisma.user.update({
            where: {
              id: account.metadata?.userId,
            },
            data: {
              stripeAccountUrl: null,
            },
          });
        }
      } else {
        console.log('Onboarding incomplete for account:', account.id);
      }
      break;

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Handle SETUP mode (payment method collection)
      if (session.mode === 'setup' && session.setup_intent) {
        console.log('Setup mode checkout completed');
        
        try {
          const setupIntent = await stripe.setupIntents.retrieve(
            session.setup_intent as string,
          );
          
          const paymentMethodId = setupIntent.payment_method as string;
          const userId = session.metadata?.userId;
          const subscriptionOfferId = session.metadata?.subscriptionOfferId;

          console.log('Payment Method ID:', paymentMethodId);
          console.log('User ID:', userId);
          console.log('Subscription Offer ID:', subscriptionOfferId);

          // Optional: Store this temporarily in a separate table or send notification
          // The Flutter app should retrieve this via the getPaymentMethodFromSession endpoint
          
        } catch (error) {
          console.error('Error processing setup intent:', error);
        }
        break;
      }

      // Handle PAYMENT mode (existing product checkout logic)
      const userId = session.metadata?.userId;
      const shippingCost = parseFloat(
        session.shipping_cost?.amount_total
          ? (session.shipping_cost.amount_total / 100).toString()
          : '0',
      );

      const paymentMethodId = session.pa;

      if (!userId || !paymentMethodId) {
        console.error('Missing metadata in Checkout Session');
        break;
      }
      
      const productTitle = session.metadata?.productNames as string;

      // Create or update payment record
      let payment = await prisma.payment.findFirst({
        where: { paymentIntentId: session.payment_intent as string },
      });

      if (payment) {
        payment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            paymentIntentId: session.payment_intent as string,
            paymentAmount: session.amount_total
              ? session.amount_total / 100
              : 0,
            amountProvider: session.customer as string,
            paymentDate: new Date(),
          },
        });
      } else {
        payment = await prisma.payment.create({
          data: {
            userId,
            paymentAmount: session.amount_total
              ? session.amount_total / 100
              : 0,
            paymentIntentId: session.payment_intent as string,
            invoice: session.return_url,
            amountProvider: session.customer as string,
            status: PaymentStatus.COMPLETED,
          },
        });
      }

      if (!payment) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Payment creation failed');
      }

      // Update checkout status (assuming you have checkoutService)
      await userSubscriptionService.createUserSubscriptionIntoDb(userId,{ checkoutId, paymentId: payment.id});

      console.log('✅ Payment completed and database updated');
      break;
    }

    case 'charge.updated': {
      const charge = event.data.object as Stripe.Charge;

      if (charge.status === 'succeeded' && charge.payment_intent) {
        await prisma.payment.updateMany({
          where: { paymentIntentId: charge.payment_intent as string },
          data: {
            status: PaymentStatus.COMPLETED,
            paymentDate: new Date(),
            invoice: charge.receipt_url,
            paymentMethodId: charge.payment_method as string,
          },
        });
        const receiptUrl = charge.receipt_url;
        const userName = charge.metadata?.userName;
        const productTitle = charge.metadata?.productNames;

        if (charge.billing_details?.email && receiptUrl) {
          const html = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="background-color: #F56100; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">Payment Successful</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px;">
            <p style="font-size: 16px;">Hello <strong>${userName || charge.billing_details?.name || 'Customer'}</strong>,</p>
            <p style="font-size: 16px;">Your payment for the product(s) <strong>${productTitle}</strong> was successful.</p>
            <p style="font-size: 16px;">You can view your payment receipt below:</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${receiptUrl}" target="_blank" style="background-color: #F56100; color: #000000; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Receipt</a>
            </div>
            <p style="font-size: 14px; color: #555;">If you have any questions, feel free to contact our support team.</p>
            <p style="font-size: 16px; margin-top: 20px;">Thank you,<br/>VitaKinetic Team</p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} VitaKinetic Team. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>
  `;

          await emailSender(
            `Your payment for ${productTitle} is successful`,
            charge.billing_details?.email,
            html,
          );
        }

        console.log('✅ Charge succeeded, payment marked as completed');
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent;

      await prisma.payment.updateMany({
        where: { paymentIntentId: intent.id },
        data: { status: PaymentStatus.FAILED },
      });

      console.log('❌ Payment failed, updated in DB');
      break;
    }

    case 'payment_intent.processing': {
      const intent = event.data.object as Stripe.PaymentIntent;

      await prisma.payment.updateMany({
        where: { paymentIntentId: intent.id },
        data: { status: PaymentStatus.REQUIRES_CAPTURE },
      });

      console.log('⏳ Payment processing, marked as pending');
      break;
    }

    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;

      await prisma.payment.updateMany({
        where: { paymentIntentId: intent.id },
        data: {
          status: PaymentStatus.COMPLETED,
          paymentDate: new Date(),
        },
      });

      console.log('✅ PaymentIntent succeeded, updated in DB');
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      if (!user) break;
      
      let planType: SubscriptionPlanStatus = SubscriptionPlanStatus.FREE;
      if (subscription.items.data.length > 0) {
        const subscriptionOffer = await prisma.subscriptionOffer.findFirst({
          where: { stripePriceId: subscription.items.data[0].price.id },
        });
        planType = subscriptionOffer?.planType ?? SubscriptionPlanStatus.FREE;
      }

      const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
      const subscriptionEndDate = currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000)
        : new Date();

      if (subscription.cancel_at_period_end) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isSubscribed: true,
            subscriptionEnd: subscriptionEndDate,
            subscriptionPlan: planType,
          },
        });
        console.log(
          'Auto-renewal turned off - subscription continues until:',
          subscriptionEndDate,
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          isSubscribed: subscription.status === 'active',
          subscriptionEnd: subscriptionEndDate,
          subscriptionPlan: planType,
        },
      });

      if (
        subscription.status === 'canceled' &&
        !subscription.cancel_at_period_end
      ) {
        console.log('Immediate cancellation detected - processing refund');

        const paymentToUpdate = await prisma.payment.findFirst({
          where: {
            stripeSubscriptionId: subscription.id,
            status: PaymentStatus.COMPLETED,
          },
        });

        if (paymentToUpdate?.paymentIntentId) {
          try {
            const refund = await stripe.refunds.create({
              payment_intent: paymentToUpdate.paymentIntentId,
            });
            console.log(
              'Refund processed for immediate cancellation:',
              refund.id,
            );
          } catch (refundError) {
            console.error('Refund failed:', refundError);
          }
        }

        await prisma.payment.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
            status: PaymentStatus.COMPLETED,
          },
          data: { status: PaymentStatus.REFUNDED },
        });

        await prisma.userSubscription.updateMany({
          where: {
            userId: user.id,
            stripeSubscriptionId: subscription.id,
          },
          data: {
            paymentStatus: PaymentStatus.REFUNDED,
            endDate: new Date(),
          },
        });
      }

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      console.log(user, 'check user from subscription deleted');

      const paymentToUpdate = await prisma.payment.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
      
      if (paymentToUpdate?.paymentIntentId) {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: paymentToUpdate.paymentIntentId,
          });
          console.log('Refund created:', refund.id);
        } catch (error) {
          console.error('Refund creation failed:', error);
        }
      }

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isSubscribed: false,
            subscriptionEnd: new Date(),
            subscriptionPlan: SubscriptionPlanStatus.FREE,
          },
        });

        await prisma.userSubscription.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
            paymentStatus: PaymentStatus.COMPLETED,
          },
          data: { endDate: new Date(), paymentStatus: PaymentStatus.REFUNDED },
        });
        
        await prisma.payment.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
            status: PaymentStatus.COMPLETED,
          },
          data: { status: PaymentStatus.REFUNDED },
        });
      }
      break;
    }

    case 'capability.updated':
      console.log('Capability updated event received. Handle accordingly.');
      break;

    case 'invoice.paid': {
      const invoice = event.data.object as any;
      const invoiceId = invoice.id;
      const paymentIntentId = invoice.payment_intent as string;
      const subscriptionId = invoice.subscription as string;
      const billingReason = invoice.billing_reason;

      if (!subscriptionId) {
        console.log('No subscription associated with this invoice');
        break;
      }

      try {
        if (billingReason === 'subscription_cycle') {
          console.log('Auto-renewal payment detected');

          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);

          const currentPeriodEnd =
            subscription.items.data[0]?.current_period_end;

          if (!currentPeriodEnd) {
            console.error('No current_period_end found in subscription items');
            break;
          }

          const newEndDate = new Date(currentPeriodEnd * 1000);
          console.log('Updating subscription end date to:', newEndDate);

          await prisma.userSubscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: {
              endDate: newEndDate,
              paymentStatus: PaymentStatus.COMPLETED,
            },
          });

          await prisma.user.updateMany({
            where: {
              userSubscriptions: {
                some: { stripeSubscriptionId: subscriptionId },
              },
            },
            data: {
              subscriptionEnd: newEndDate,
              isSubscribed: true,
            },
          });

          const userSubscription = await prisma.userSubscription.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
            include: {
              user: {
                select: { id: true, stripeCustomerId: true },
              },
            },
          });

          if (userSubscription && userSubscription.user) {
            await prisma.payment.create({
              data: {
                stripeSubscriptionId: subscriptionId,
                invoiceId: invoiceId,
                paymentIntentId: paymentIntentId,
                paymentAmount: invoice.amount_paid
                  ? invoice.amount_paid / 100
                  : 0,
                amountProvider:
                  userSubscription.user.stripeCustomerId ||
                  invoice.customer ||
                  '',
                status: PaymentStatus.COMPLETED,
                user: {
                  connect: { id: userSubscription.userId },
                },
              },
            });
            console.log('Created renewal payment record');
          }

          console.log('Auto-renewal successfully processed');
        } else if (billingReason === 'subscription_create') {
          console.log('Initial subscription payment detected');

          const existingPayment = await prisma.payment.findFirst({
            where: {
              stripeSubscriptionId: subscriptionId,
              status: PaymentStatus.COMPLETED,
              invoiceId: invoiceId,
            },
          });

          if (existingPayment && !existingPayment.paymentIntentId) {
            await prisma.payment.update({
              where: { id: existingPayment.id },
              data: {
                paymentIntentId: paymentIntentId,
              },
            });
            console.log('Updated initial payment with paymentIntentId');
          }

          if (existingPayment && !existingPayment.invoiceId) {
            await prisma.payment.update({
              where: { id: existingPayment.id },
              data: {
                invoiceId: invoiceId,
              },
            });
            console.log('Updated initial payment with invoiceId');
          }
        } else if (billingReason === 'subscription_update') {
          console.log('Subscription update payment detected');

          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const currentPeriodEnd =
            subscription.items.data[0]?.current_period_end;

          if (currentPeriodEnd) {
            const newEndDate = new Date(currentPeriodEnd * 1000);

            await prisma.userSubscription.updateMany({
              where: { stripeSubscriptionId: subscriptionId },
              data: {
                endDate: newEndDate,
              },
            });

            await prisma.user.updateMany({
              where: {
                userSubscriptions: {
                  some: { stripeSubscriptionId: subscriptionId },
                },
              },
              data: {
                subscriptionEnd: newEndDate,
              },
            });
          }

          const userSubscription = await prisma.userSubscription.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
            include: {
              user: {
                select: { id: true, stripeCustomerId: true },
              },
            },
          });

          if (userSubscription && userSubscription.user) {
            await prisma.payment.create({
              data: {
                stripeSubscriptionId: subscriptionId,
                invoiceId: invoiceId,
                paymentIntentId: paymentIntentId,
                paymentAmount: invoice.amount_paid
                  ? invoice.amount_paid / 100
                  : 0,
                amountProvider:
                  userSubscription.user.stripeCustomerId ||
                  invoice.customer ||
                  '',
                status: PaymentStatus.COMPLETED,
                user: {
                  connect: { id: userSubscription.userId },
                },
              },
            });
            console.log('Created update payment record');
          }
        } else {
          console.log('Other invoice type:', billingReason);

          const existingPayment = await prisma.payment.findFirst({
            where: {
              invoiceId: invoiceId,
            },
          });

          if (!existingPayment) {
            const userSubscription = await prisma.userSubscription.findFirst({
              where: { stripeSubscriptionId: subscriptionId },
              include: {
                user: {
                  select: { id: true, stripeCustomerId: true },
                },
              },
            });

            if (userSubscription && userSubscription.user) {
              await prisma.payment.create({
                data: {
                  stripeSubscriptionId: subscriptionId,
                  invoiceId: invoiceId,
                  paymentIntentId: paymentIntentId,
                  paymentAmount: invoice.amount_paid
                    ? invoice.amount_paid / 100
                    : 0,
                  amountProvider:
                    userSubscription.user.stripeCustomerId ||
                    invoice.customer ||
                    '',
                  status: PaymentStatus.COMPLETED,
                  user: {
                    connect: { id: userSubscription.userId },
                  },
                },
              });
              console.log('Created payment record for other invoice type');
            }
          }
        }
      } catch (error) {
        console.error('Error processing invoice.paid:', error);
      }
      break;
    }

    case 'invoice.upcoming': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const subscriptionId = (invoice as any).subscription as string;
      const amountDue = invoice.amount_due / 100;
      const dueDate = invoice.due_date
        ? new Date(invoice.due_date * 1000)
        : null;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
        include: {
          userSubscriptions: {
            where: { stripeSubscriptionId: subscriptionId },
          },
        },
      });

      if (user && user.userSubscriptions.length > 0 && dueDate) {
        // Send renewal reminder notification here
        console.log(`Renewal reminder for user ${user.id}: $${amountDue} on ${dueDate}`);
      }
      break;
    }

    case 'invoice.payment_failed':
      const failedInvoice = event.data.object as Stripe.Invoice;
      console.log('Invoice payment failed for invoice:', failedInvoice.id);
      break;

    case 'payment_method.attached':
      const paymentMethod = event.data.object as Stripe.PaymentMethod;
      console.log(
        'PaymentMethod was attached to a Customer!',
        paymentMethod.id,
      );
      break;

    case 'financial_connections.account.created':
      console.log(
        'Financial connections account created event received. Handle accordingly.',
      );
      break;

    case 'account.application.authorized':
      const authorizedAccount = event.data.object;
      console.log('Application authorized for account:', authorizedAccount.id);
      break;

    case 'customer.created':
      const customer = event.data.object;
      console.log('New customer created:', customer.id);
      break;

    case 'account.external_account.created':
      const externalAccount = event.data.object;
      console.log('External account created:', externalAccount);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).send('Event received');
});

export const paymentController = {
  createPayment,
  authorizedPaymentWithSaveCard,
  capturePaymentRequest,
  getPaymentList,
  getPaymentById,
  updatePayment,
  deletePayment,
  handleWebHook,
};

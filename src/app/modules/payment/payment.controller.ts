import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { paymentService } from './payment.service';
import Stripe from 'stripe';
import config from '../../../config';
import prisma from '../../utils/prisma';
import {
  OrderStatus,
  PaymentStatus,
  SubscriptionPlanStatus,
  SubscriptionStatus,
  UserRoleEnum,
} from '@prisma/client';
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

const createAccount = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.createAccountIntoStripe(user.id);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Create account successfully',
    data: result,
  });
});

const createNewAccount = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await paymentService.createNewAccountIntoStripe(user.id);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Create new account successfully',
    data: result,
  });
});

// Authorize the customer with the amount and send payment request
// const authorizedPaymentWithSaveCard = catchAsync(async (req: any, res: any) => {
//   const user = req.user as any;
//   // console.log(user)
//   const result = await paymentService.authorizePaymentWithStripeCheckout(
//     user.id,
//     req.body,
//   );

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'Authorized customer and payment request successfully',
//     data: result,
//   });
// });

// Capture the payment request and deduct the amount
// const capturePaymentRequest = catchAsync(async (req: any, res: any) => {
//   const result = await paymentService.capturePaymentRequestToStripe(req.body);

//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: 'Capture payment request and payment deduct successfully',
//     data: result,
//   });
// });

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

// webhook handler for Stripe events

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
      console.log('Checkout session completed:', session.id);

      // =================================================================
      // SECTION 1: Handle PRODUCT ORDER Payments (mode = 'payment')
      // =================================================================
      if (session.mode === 'payment') {
        const productId = session.metadata?.productId;
        const userId = session.metadata?.userId;
        const trainerId = session.metadata?.trainerId;
        const customPricingId = session.metadata?.customPricingId;

        if (productId && userId) {
          console.log('Processing product order payment for user:', userId);

          try {
            // Find the pending order
            const order = await prisma.order.findFirst({
              where: {
                userId,
                productId,
                paymentStatus: PaymentStatus.PENDING,
                status: OrderStatus.PENDING,
              },
              orderBy: {
                createdAt: 'desc',
              },
            });

            if (order) {
              // Update order status
              await prisma.order.update({
                where: { id: order.id },
                data: {
                  // invoice: session.url || undefined,
                  paymentStatus: PaymentStatus.COMPLETED,
                  status: OrderStatus.COMPLETED,
                  customPricingId: customPricingId || undefined,
                },
              });

              // Create payment record
              await prisma.payment.create({
                data: {
                  userId,
                  orderId: order.id,
                  productId,
                  paymentIntentId: session.payment_intent as string,
                  paymentAmount: session.amount_total
                    ? session.amount_total / 100
                    : 0,
                  amountProvider: session.customer as string,
                  status: PaymentStatus.COMPLETED,
                  // invoice: session.url,
                },
              });

              // Increment product purchase count
              await prisma.product.update({
                where: { id: productId },
                data: {
                  totalPurchased: { increment: 1 },
                },
              });

              console.log('✅ Product order payment completed successfully');
            } else {
              console.log('⚠️ No pending order found for this payment');
            }
          } catch (error) {
            console.error('❌ Error processing product order:', error);
          }
        }
      }

      // =================================================================
      // SECTION 2: Handle SUBSCRIPTION Payments (mode = 'subscription')
      // =================================================================
      else if (session.mode === 'subscription') {
        const userId = session.metadata?.userId;
        const productId = session.metadata?.productId;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (userId && productId && subscriptionId) {
          console.log('Processing subscription order for user:', userId);

          try {
            // Find the pending order
            const order = await prisma.order.findFirst({
              where: {
                userId,
                productId,
                paymentStatus: PaymentStatus.PENDING,
                status: OrderStatus.PENDING,
              },
              orderBy: {
                createdAt: 'desc',
              },
            });

            if (order) {
              // Update order with subscription info
              await prisma.order.update({
                where: { id: order.id },
                data: {
                  paymentStatus: PaymentStatus.COMPLETED,
                  status: OrderStatus.COMPLETED,
                  stripeSubscriptionId: subscriptionId,
                  subscriptionStatus: SubscriptionStatus.ACTIVE,
                },
              });

              // Don't create payment here - let invoice.payment_succeeded handle it with full invoice details
              console.log('✅ Order updated, payment will be created when invoice is paid');

              // Calculate subscription end date based on invoice frequency
              const currentDate = new Date();
              let endDate = new Date(currentDate);

              switch (order.invoiceFrequency) {
                case 'WEEKLY':
                  endDate.setDate(currentDate.getDate() + 7);
                  break;
                case 'MONTHLY':
                  endDate.setMonth(currentDate.getMonth() + 1);
                  break;
                case 'ANNUALLY':
                  endDate.setFullYear(currentDate.getFullYear() + 1);
                  break;
                default:
                  endDate.setMonth(currentDate.getMonth() + 1); // Default to monthly
              }

              // Create UserSubscription record for tracking
              await prisma.userSubscription.create({
                data: {
                  userId,
                  productId,
                  stripeSubscriptionId: subscriptionId,
                  startDate: currentDate,
                  endDate: endDate,
                  paymentStatus: PaymentStatus.COMPLETED,
                },
              });

              // Increment product purchase count
              await prisma.product.update({
                where: { id: productId },
                data: {
                  totalPurchased: { increment: 1 },
                  totalRevenue: {
                    increment: session.amount_total
                      ? session.amount_total / 100
                      : 0,
                  },
                  activeClients: { increment: 1 },
                },
              });

              console.log(
                '✅ Subscription order and tracking created successfully',
              );
            } else {
              console.log('⚠️ No pending order found for this subscription');
            }
          } catch (error) {
            console.error('❌ Error processing subscription order:', error);
          }
        }
      }

      break;
    }

    // case 'charge.succeeded': {
    //   const charge = event.data.object as Stripe.Charge;
    //     console.log('Charge succeeded:', charge.id);

    //     if(charge.status === 'succeeded' && charge.payment_intent) {
    //     }
    //   break;
    // }

    case 'charge.updated': {
      const charge = event.data.object as Stripe.Charge;

      // Only process if charge succeeded and has a payment intent
      if (charge.status === 'succeeded' && charge.payment_intent) {
        // Get the payment record before updating
        const paymentRecord = await prisma.payment.findFirst({
          where: { paymentIntentId: charge.payment_intent as string },
        });

        if (!paymentRecord) {
          console.log('No payment record found for charge:', charge.id);
          return;
        }

        // Update payment record in database
        await prisma.payment.updateMany({
          where: { paymentIntentId: charge.payment_intent as string },
          data: {
            status: PaymentStatus.COMPLETED,
            invoice: charge.receipt_url || undefined,
          },
        });

        // update product
        if (paymentRecord.productId) {
          await prisma.product.update({
            where: { id: paymentRecord.productId },
            data: {
              totalRevenue: { increment: charge.amount / 100 },
              activeClients: { increment: 1 },
            },
          });
        }

        // Check if this charge is for an ORDER (product purchase)
        const orderId = paymentRecord.orderId;

        if (orderId) {
          // This is a product order payment
          console.log('Processing order charge:', orderId);

          // Update order status to purchased and payment completed
          await prisma.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: PaymentStatus.COMPLETED,
              status: OrderStatus.COMPLETED,
              invoice: charge.receipt_url || undefined,
            },
          });

          // Send order confirmation email if email exists
          if (charge.billing_details?.email && charge.receipt_url) {
            const userName =
              charge.metadata?.userName || charge.billing_details?.name;
            const productName = charge.metadata?.productName || 'Product';

            const html = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="background-color: #8FAF9A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">Order Confirmed! 🎉</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px;">
            <p style="font-size: 16px;">Hello <strong>${userName || 'Valued Customer'}</strong>,</p>
            <p style="font-size: 16px;">Thank you for your purchase! Your order has been confirmed successfully.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Product:</strong> ${productName}</p>
              <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId}</p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> $${(charge.amount / 100).toFixed(2)}</p>
            </div>

            <p style="font-size: 16px;">You can view your payment receipt by clicking the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${charge.receipt_url}" target="_blank" style="background-color: #8FAF9A; color: #000000; padding: 12px 30px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">View Receipt</a>
            </div>

            <p style="font-size: 14px; color: #555; border-top: 1px solid #e0e0e0; padding-top: 15px; margin-top: 20px;">
              We'll notify you once your order is ready for delivery or access. If you have any questions, feel free to contact our support team.
            </p>

            <p style="font-size: 16px; margin-top: 30px;">
              Best regards,<br/>
              <strong>VitaKinetic Team</strong>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
            <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} VitaKinetic. All rights reserved.</p>
            <p style="margin: 5px 0;">This is an automated email. Please do not reply.</p>
          </td>
        </tr>
      </table>
    </div>
        `;

            // Send email using your emailSender function
            await emailSender(
              `Order Confirmation - ${productName}`,
              charge.billing_details.email,
              html,
            );

            console.log(
              '✅ Order confirmation email sent to:',
              charge.billing_details.email,
            );
          }

          console.log('✅ Order payment completed and status updated');
        } else {
          console.log('✅ Regular payment charge updated');
        }
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

    // Inside handleWebHook function, update customer.subscription.created case:

    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription;

      console.log('🔔 customer.subscription.created event received');
      console.log('Subscription ID:', subscription.id);
      console.log('Customer ID:', subscription.customer);
      console.log('Status:', subscription.status);
      console.log('Metadata:', JSON.stringify(subscription.metadata));

      // Find user using the customer ID from subscription
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      if (!user) {
        console.log('⚠️ No user found for customer ID:', subscription.customer);
        break;
      }

      console.log('✅ User found:', user.email, 'User ID:', user.id);

      // Check subscription status before processing
      if (
        subscription.status === 'incomplete' ||
        subscription.status === 'incomplete_expired' ||
        subscription.status === 'past_due'
      ) {
        console.log(
          '⚠️ Subscription payment not completed. Status:',
          subscription.status,
        );
        console.log('🛑 Skipping processing until payment completes');
        break;
      }

      console.log('✅ Subscription status is valid:', subscription.status);

      // ============================================================
      // DETERMINE SUBSCRIPTION TYPE: Product vs Platform Subscription
      // ============================================================

      // Check if this is a PRODUCT subscription (already handled in checkout.session.completed)
      const order = await prisma.order.findFirst({
        where: {
          userId: user.id,
          stripeSubscriptionId: subscription.id,
        },
      });

      if (order) {
        console.log('✅ This is a PRODUCT SUBSCRIPTION');
        console.log('Order ID:', order.id, 'Product ID:', order.productId);
        console.log(
          '✅ Order already created in checkout.session.completed - no further action needed',
        );
        break;
      }

      console.log(
        'ℹ️ No order found - checking if this is a PLATFORM SUBSCRIPTION...',
      );

      // This is a PLATFORM subscription - requires subscriptionOfferId metadata
      const subscriptionOfferId = subscription.metadata?.subscriptionOfferId;
      const pricingRuleId = subscription.metadata?.pricingRuleId;

      if (!subscriptionOfferId) {
        console.log('❌ Missing subscriptionOfferId in metadata');
        console.log('This is required for platform subscriptions');
        console.log(
          'Metadata received:',
          JSON.stringify(subscription.metadata),
        );
        break;
      }

      console.log(
        '✅ Valid PLATFORM SUBSCRIPTION - subscriptionOfferId:',
        subscriptionOfferId,
      );

      const subscriptionWithPeriod =
        subscription as unknown as Stripe.Subscription & {
          current_period_start: number;
          current_period_end: number;
        };

      console.log(
        'Period Start:',
        new Date(subscriptionWithPeriod.current_period_start * 1000),
      );
      console.log(
        'Period End:',
        new Date(subscriptionWithPeriod.current_period_end * 1000),
      );

      try {
        const userSubscription =
          await userSubscriptionService.createUserSubscriptionFromWebhook(
            user.id,
            subscriptionOfferId,
            subscription.id,
            subscriptionWithPeriod.current_period_start,
            subscriptionWithPeriod.current_period_end,
          );

        console.log(
          '✅ Platform subscription created in database:',
          userSubscription.id,
        );

        // Record pricing rule usage if applied
        if (pricingRuleId && userSubscription) {
          await prisma.$transaction(async tx => {
            await tx.subscriptionPricingUsage.create({
              data: {
                pricingRuleId: pricingRuleId,
                userId: user.id,
                subscriptionId: userSubscription.id,
              },
            });

            await tx.subscriptionPricingRule.update({
              where: { id: pricingRuleId },
              data: { usageCount: { increment: 1 } },
            });
          });

          console.log(
            '✅ Pricing rule usage recorded for rule:',
            pricingRuleId,
          );
        }

        console.log('✅ Platform subscription fully processed from webhook');
      } catch (error) {
        console.error(
          '❌ Error creating platform subscription from webhook:',
          error,
        );
      }

      // Send invoice email if active
      if (subscription.status === 'active' && subscription.latest_invoice) {
        try {
          console.log('📧 Attempting to send invoice email...');
          console.log('Latest invoice:', subscription.latest_invoice);

          const invoiceId = subscription.latest_invoice;

          if (typeof invoiceId === 'string') {
            await stripe.invoices.sendInvoice(invoiceId);
            console.log(
              '✅ Invoice email sent successfully. Invoice ID:',
              invoiceId,
            );
          } else {
            console.log('⚠️ Invoice ID is not a string, cannot send invoice.');
          }
        } catch (error) {
          console.error('⚠️ Invoice email sending failed:', error);
          console.log('Subscription is still active despite email failure');
        }
      } else {
        console.log(
          'ℹ️ No invoice email sent - Status:',
          subscription.status,
          'Has invoice:',
          !!subscription.latest_invoice,
        );
      }

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

      // if (paymentToUpdate?.paymentIntentId) {
      //   try {
      //     const refund = await stripe.refunds.create({
      //       payment_intent: paymentToUpdate.paymentIntentId,
      //     });
      //     console.log('Refund created:', refund.id);
      //   } catch (error) {
      //     console.error('Refund creation failed:', error);
      //   }
      // }

      if (user) {
        if (user?.role === UserRoleEnum.TRAINER) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isSubscribed: false,
              subscriptionEnd: new Date(),
              subscriptionPlan: SubscriptionPlanStatus.FREE,
            },
          });
        }

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

        await prisma.order.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
          },
          data: {
            subscriptionStatus: SubscriptionStatus.CANCELLED,
            nextBillingDate: null,
            currentState: OrderStatus.CANCELLED,
            status: OrderStatus.CANCELLED,
            paymentStatus: PaymentStatus.REFUNDED,
          },
        });

        await prisma.product.updateMany({
          where: {
            orders: {
              some: {
                stripeSubscriptionId: subscription.id,
              },
            },
          },
          data: {
            totalRevenue: {
              decrement: subscription.items.data[0].price.unit_amount
                ? subscription.items.data[0].price.unit_amount / 100
                : 0,
            },
            activeClients: { decrement: 1 },
            totalPurchased: { decrement: 1 },
          },
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

          // Check if this is a product subscription (has Order)
          const productOrder = await prisma.order.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
          });

          if (productOrder) {
            console.log('Product subscription renewal - will be handled by invoice.payment_succeeded');
            break;
          }

          // Handle platform subscription renewal only
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);

          const currentPeriodEnd =
            subscription.items.data[0]?.current_period_end;

          if (!currentPeriodEnd) {
            console.error('No current_period_end found in subscription items');
            break;
          }

          const newEndDate = new Date(currentPeriodEnd * 1000);
          console.log('Updating platform subscription end date to:', newEndDate);

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
            console.log('Created platform subscription renewal payment record');
          }

          console.log('Platform subscription auto-renewal successfully processed');
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
                invoice: invoice.hosted_invoice_url || undefined,
              },
            });
            await prisma.order.updateMany({
              where: { stripeSubscriptionId: subscriptionId },
              data: {
                invoice: invoice.hosted_invoice_url || undefined,
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

          // Check if this is a product subscription (has Order)
          const productOrder = await prisma.order.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
          });

          if (productOrder) {
            console.log('Product subscription update - will be handled by invoice.payment_succeeded');
            break;
          }

          // Handle platform subscription update only
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
            console.log('Created platform subscription update payment record');
          }
        } else {
          console.log('Other invoice type:', billingReason);

          // Check if this is a product subscription (has Order)
          const productOrder = await prisma.order.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
          });

          if (productOrder) {
            console.log('Product subscription - will be handled by invoice.payment_succeeded');
            break;
          }

          // Handle platform subscription only
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
              console.log('Created platform subscription payment record for other invoice type');
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
        console.log(
          `Renewal reminder for user ${user.id}: $${amountDue} on ${dueDate}`,
        );
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const paidInvoice = event.data.object as any;
      const subscriptionId =
        typeof paidInvoice.subscription === 'string'
          ? paidInvoice.subscription
          : paidInvoice.subscription?.id;
      const customerId =
        typeof paidInvoice.customer === 'string'
          ? paidInvoice.customer
          : paidInvoice.customer?.id;
      const invoiceId = paidInvoice.id;
      const paymentIntentId =
        typeof paidInvoice.payment_intent === 'string'
          ? paidInvoice.payment_intent
          : paidInvoice.payment_intent?.id;

      if (!subscriptionId) {
        console.log('No subscription ID in invoice');
        break;
      }

      try {
        // Check if this is a product order subscription
        const productOrder = await prisma.order.findFirst({
          where: {
            stripeSubscriptionId: subscriptionId,
          },
          include: {
            user: true,
            product: true,
          },
        });

        if (productOrder) {
          // Handle product subscription payment
          console.log(
            'Processing recurring payment for product order:',
            productOrder.id,
          );

          // Calculate next billing date based on invoice frequency
          let nextBillingDate = new Date();
          if (productOrder.invoiceFrequency === 'WEEKLY') {
            nextBillingDate.setDate(nextBillingDate.getDate() + 7);
          } else if (productOrder.invoiceFrequency === 'MONTHLY') {
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          } else if (productOrder.invoiceFrequency === 'ANNUALLY') {
            nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
          }

          // Update order with next billing date
          await prisma.order.update({
            where: { id: productOrder.id },
            data: {
              nextBillingDate,
              subscriptionStatus: SubscriptionStatus.ACTIVE,
              invoice: paidInvoice.hosted_invoice_url || undefined,
            },
          });

          // Update UserSubscription endDate for product subscription tracking
          await prisma.userSubscription.updateMany({
            where: {
              stripeSubscriptionId: subscriptionId,
              productId: productOrder.productId,
            },
            data: {
              endDate: nextBillingDate,
              paymentStatus: PaymentStatus.COMPLETED,
            },
          });
          console.log(
            '✅ Updated UserSubscription endDate to:',
            nextBillingDate,
          );

          // Check for existing payment by subscriptionId and orderId to avoid duplicates
          const existingPayment = await prisma.payment.findFirst({
            where: {
              OR: [
                { invoiceId: invoiceId },
                {
                  stripeSubscriptionId: subscriptionId,
                  orderId: productOrder.id,
                },
              ],
            },
          });

          if (existingPayment) {
            // Update existing payment with invoice details
            await prisma.payment.update({
              where: { id: existingPayment.id },
              data: {
                orderId: productOrder.id,
                invoiceId: invoiceId,
                paymentIntentId: paymentIntentId || existingPayment.paymentIntentId,
                invoice: paidInvoice.hosted_invoice_url || undefined,
                status: PaymentStatus.COMPLETED,
                paymentAmount: paidInvoice.amount_paid
                  ? paidInvoice.amount_paid / 100
                  : existingPayment.paymentAmount,
              },
            });
            console.log(
              '✅ Updated existing payment record with invoice details',
            );
          } else {
            // Create new payment record only if none exists
            await prisma.payment.create({
              data: {
                userId: productOrder.userId,
                orderId: productOrder.id,
                productId: productOrder.productId,
                paymentIntentId: paymentIntentId || '',
                invoiceId: invoiceId,
                stripeSubscriptionId: subscriptionId || '',
                paymentAmount: paidInvoice.amount_paid
                  ? paidInvoice.amount_paid / 100
                  : 0,
                amountProvider: customerId || '',
                status: PaymentStatus.COMPLETED,
                invoice: paidInvoice.hosted_invoice_url || '',
              },
            });
            console.log(
              '✅ Created payment record for product subscription',
            );
          }

          // Send email notification for product subscription payment
          if (productOrder.user?.email) {
            try {
              console.log(
                'Sending product subscription payment email to:',
                productOrder.user.email,
              );

              await emailSender(
                `Payment Successful - ${productOrder.product?.productName || 'Product Subscription'}`,
                productOrder.user.email,
                `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 10px;
            padding: 10px;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px 20px;
            text-align: center;
            color: white;
        }
        .content {
            padding: 30px;
        }
        .invoice-section {
            background-color: #f7fafc;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #667eea;
            margin: 25px 0;
        }
        .invoice-link {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Payment Successful! 💳</h1>
        </div>
        <div class="content">
            <p><strong>Dear ${productOrder.user.fullName},</strong></p>
            <p>Your recurring payment for <strong>${productOrder.product?.productName || 'Product Subscription'}</strong> has been processed successfully.</p>
            <div class="invoice-section">
                <p><strong>Payment Amount:</strong> $${paidInvoice.amount_paid ? (paidInvoice.amount_paid / 100).toFixed(2) : '0.00'}</p>
                <p><strong>Next Billing Date:</strong> ${productOrder.nextBillingDate ? new Date(productOrder.nextBillingDate).toLocaleDateString() : 'N/A'}</p>
                ${paidInvoice.hosted_invoice_url ? `<a href="${paidInvoice.hosted_invoice_url}" class="invoice-link">View Invoice</a>` : ''}
            </div>
            <p>Thank you for your continued subscription!</p>
            <p><strong>Best regards,<br/>The VitaKinetic Team</strong></p>
        </div>
    </div>
</body>
</html>`,
              );
              console.log(
                '✅ Product subscription payment email sent successfully',
              );
            } catch (emailError) {
              console.error(
                '❌ Failed to send product subscription email:',
                emailError,
              );
            }
          }
        } else {
          // Handle user subscription payment (existing logic)
          const userId = paidInvoice.lines.data[0]?.metadata?.userId;

          if (!userId) {
            console.log('Missing userId in subscription metadata');
            break;
          }

          const user = await prisma.user.findFirst({
            where: { id: userId },
          });

          if (!user) {
            console.log('User not found for subscription payment');
            break;
          }

          // Send subscription activation/renewal email
          if (user.email) {
            try {
              console.log(
                'Sending user subscription payment email to:',
                user.email,
              );

              const latestInvoice = paidInvoice.hosted_invoice_url;

              await emailSender(
                'Your Subscription Payment Successful',
                user.email,
                `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 10px;
            padding: 10px;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px 20px;
            text-align: center;
            color: white;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #2d3748;
        }
        .message {
            margin-bottom: 25px;
            font-size: 16px;
            color: #4a5568;
        }
        .invoice-section {
            background-color: #f7fafc;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #667eea;
            margin: 25px 0;
        }
        .invoice-title {
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 10px;
        }
        .invoice-link {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 10px;
        }
        .invoice-link:hover {
            background-color: #5a67d8;
        }
        .support {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #718096;
        }
        .footer {
            background-color: #edf2f7;
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #718096;
        }
        .signature {
            margin-top: 25px;
            color: #2d3748;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo"> VitaKinetic </div>
            <h1>Subscription Activated</h1>
        </div>
        
        <div class="content">
            <div class="greeting">Dear ${user.fullName},</div>
            
            <div class="message">
                Thank you for subscribing! Your subscription is now active and you can start enjoying all the premium features immediately.
            </div>

            <div class="invoice-section">
                <div class="invoice-title">📄 Your Invoice</div>
                <p>You can view and download your invoice directly from our secure payment portal:</p>
                ${
                  latestInvoice
                    ? `<a href="${latestInvoice}" class="invoice-link" target="_blank">
                        View & Download Invoice
                      </a>`
                    : `<p style="color: #8FAF9A;">Invoice link will be available shortly. If you don't receive it within 24 hours, please contact support.</p>`
                }
                
            </div>

            <div class="message">
                <strong>What's next?</strong><br>
                • Access your premium features immediately<br>
                • Manage your subscription from your account settings<br>
                • Receive automatic receipts for future payments
            </div>

            <div class="support">
                <strong>Need Help?</strong><br>
                If you have any questions or need assistance, our support team is here to help!<br>
                📧 Email: support@vitakinetic.com<br>
                ⏰ Hours: Monday-Friday, 9AM-6PM
            </div>

            <div class="signature">
                Best regards,<br>
                <strong>The VitaKinetic Team</strong>
            </div>
        </div>

        <div class="footer">
            <p>©${new Date().getFullYear()} VitaKinetic. All rights reserved.</p>
            <p>You're receiving this email because you recently subscribed to our service.</p>
        </div>
    </div>
</body>
                </html>`,
              );
              console.log(
                '✅ User subscription payment email sent successfully to:',
                user.email,
              );
            } catch (emailError) {
              console.error(
                '❌ CRITICAL: Failed to send user subscription email:',
                emailError,
              );
              // Log to external monitoring service if available
            }
          } else {
            console.error(
              '❌ CRITICAL: User has no email address, cannot send subscription notification',
            );
          }
        }
      } catch (error) {
        console.error('❌ Error processing invoice.payment_succeeded:', error);
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

const cancelPaymentRequest = catchAsync(async (req: any, res: any) => {
  const user = req.user as any;
  const result = await paymentService.cancelPaymentRequestToStripe(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Cancel payment request successfully',
    data: result,
  });
});

export const paymentController = {
  createPayment,
  createAccount,
  createNewAccount,
  cancelPaymentRequest,
  // authorizedPaymentWithSaveCard,
  // capturePaymentRequest,
  getPaymentList,
  getPaymentById,
  updatePayment,
  deletePayment,
  handleWebHook,
};

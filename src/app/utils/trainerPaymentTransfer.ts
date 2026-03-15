import Stripe from 'stripe';
import config from '../../config';
import prisma from './prisma';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { UserRoleEnum } from '@prisma/client';

const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

interface TransferPayload {
  orderId: string;
  trainerId: string;
  amount: number; // Amount in cents (e.g., 10000 = $100)
  paymentIntentId?: string;
  reason?: string;
}

interface TransferResult {
  success: boolean;
  transferId?: string;
  message: string;
  error?: string;
}

/**
 * Transfer payment directly to trainer's Stripe account
 * @param payload - Contains trainerId, amount, orderId, and other metadata
 * @returns Transfer result with status and transfer ID
 */
export const transferToTrainerAccount = async (payload: TransferPayload): Promise<TransferResult> => {
  try {
    const { orderId, trainerId, amount, paymentIntentId, reason } = payload;

    // Validate trainer exists and has completed onboarding
    const trainer = await prisma.user.findUnique({
      where: { id: trainerId },
      select: {
        id: true,
        fullName: true,
        email: true,
        stripeAccountId: true,
        onBoarding: true,
      },
    });

    if (!trainer) {
      return {
        success: false,
        message: 'Trainer not found',
        error: `Trainer with ID ${trainerId} does not exist`,
      };
    }

    // Check if trainer has completed onboarding
    if (!trainer.onBoarding) {
      return {
        success: false,
        message: 'Trainer onboarding incomplete',
        error: `Trainer ${trainer.fullName} has not completed Stripe onboarding`,
      };
    }

    // Check if trainer has Stripe account ID
    if (!trainer.stripeAccountId) {
      return {
        success: false,
        message: 'Trainer Stripe account not configured',
        error: `Trainer ${trainer.fullName} does not have a Stripe account connected`,
      };
    }

    // Validate amount is positive
    if (amount <= 0) {
      return {
        success: false,
        message: 'Invalid transfer amount',
        error: 'Transfer amount must be greater than 0',
      };
    }

    // Create transfer to trainer's Stripe account
    const transfer = await stripe.transfers.create({
      amount: amount, // Amount is in cents
      currency: 'usd',
      destination: trainer.stripeAccountId, // Trainer's Stripe connected account
      metadata: {
        orderId,
        trainerId,
        paymentIntentId: paymentIntentId || 'N/A',
        reason: reason || 'Direct payment for product purchase',
        transferredAt: new Date().toISOString(),
      },
      description: `Payment transfer for order ${orderId}`,
    });

    // Log successful transfer
    console.log(`✅ Transfer successful - Transfer ID: ${transfer.id}, Trainer: ${trainer.fullName}, Amount: $${amount / 100}`);

    // Return success response
    return {
      success: true,
      transferId: transfer.id,
      message: `Successfully transferred $${amount / 100} to ${trainer.fullName}`,
    };
  } catch (error: any) {
    // Handle Stripe-specific errors
    const errorMessage = error?.message || 'Unknown error occurred during transfer';
    console.error(`❌ Transfer failed:`, error);

    return {
      success: false,
      message: 'Transfer to trainer account failed',
      error: errorMessage,
    };
  }
};

/**
 * Get transfer status from Stripe
 * @param transferId - The Stripe transfer ID
 * @returns Transfer object with status
 */
export const getTransferStatus = async (transferId: string) => {
  try {
    const transfer = await stripe.transfers.retrieve(transferId);
    return transfer;
  } catch (error: any) {
    console.error('Error retrieving transfer status:', error);
    throw new AppError(httpStatus.BAD_REQUEST, `Failed to retrieve transfer status: ${error.message}`);
  }
};

/**
 * Verify trainer can receive payments
 * @param trainerId - The trainer's user ID
 * @returns Object with trainer's payment readiness status
 */
export const verifyTrainerPaymentReadiness = async (trainerId: string) => {
  try {
    const trainer = await prisma.user.findUnique({
      where: { id: trainerId, role: UserRoleEnum.TRAINER },
      select: {
        id: true,
        fullName: true,
        stripeAccountId: true,
        onBoarding: true,
      },
    });

    if (!trainer) {
      return {
        ready: false,
        reason: 'Trainer not found',
      };
    }

    if (!trainer.onBoarding) {
      return {
        ready: false,
        reason: 'Trainer has not completed Stripe onboarding',
      };
    }

    if (!trainer.stripeAccountId) {
      return {
        ready: false,
        reason: 'Trainer Stripe account not configured',
      };
    }

    // Verify Stripe account is in good standing
    try {
      const account = await stripe.accounts.retrieve(trainer.stripeAccountId);
      
      if (!account.charges_enabled || !account.payouts_enabled) {
        return {
          ready: false,
          reason: 'Trainer Stripe account not fully activated for charges and payouts',
          accountStatus: {
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
          },
        };
      }
    } catch (error: any) {
      return {
        ready: false,
        reason: 'Could not verify Stripe account status',
        error: error.message,
      };
    }

    return {
      ready: true,
      trainerName: trainer.fullName,
      stripeAccountId: trainer.stripeAccountId,
    };
  } catch (error: any) {
    console.error('Error verifying trainer payment readiness:', error);
    return {
      ready: false,
      reason: 'Error verifying trainer payment readiness',
      error: error.message,
    };
  }
};

export default {
  transferToTrainerAccount,
  getTransferStatus,
  verifyTrainerPaymentReadiness,
};

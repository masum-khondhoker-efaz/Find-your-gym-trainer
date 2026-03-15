# Trainer Direct Payment Implementation Guide

## Overview
This implementation enables trainers to receive payments directly to their Stripe connected accounts without any platform admin charges. When users purchase trainer products, payment is automatically transferred from the platform's Stripe account to the trainer's Stripe account.

## Architecture

### Key Components

#### 1. **Trainer Payment Transfer Utility** (`src/app/utils/trainerPaymentTransfer.ts`)
Core utility functions for managing trainer payments:

- **`transferToTrainerAccount(payload)`**: Initiates a Stripe transfer to trainer's account
  - Validates trainer exists and has completed Stripe onboarding
  - Checks that trainer has `stripeAccountId` configured
  - Validates trainer's Stripe account has charges and payouts enabled
  - Creates transfer using Stripe transfers API
  - Returns success/failure status

- **`getTransferStatus(transferId)`**: Retrieves status of a specific transfer from Stripe

- **`verifyTrainerPaymentReadiness(trainerId)`**: Comprehensive check to verify trainer can receive payments
  - Checks trainer record exists
  - Validates `onBoarding` flag is true
  - Confirms `stripeAccountId` is set
  - Verifies Stripe account has charges_enabled and payouts_enabled
  - Returns readiness status and details

#### 2. **Payment Controller Updates** (`src/app/modules/payment/payment.controller.ts`)

**New imports:**
```typescript
import { transferToTrainerAccount, verifyTrainerPaymentReadiness } from '../../utils/trainerPaymentTransfer';
```

**Modified webhook handler - `checkout.session.completed` (one-time payments):**
- After payment is recorded and order status updated
- Checks if `order.trainerId` exists
- Calls `transferToTrainerAccount()` with:
  - `orderId`: Order ID
  - `trainerId`: Trainer's user ID
  - `amount`: Payment amount in cents
  - `paymentIntentId`: Stripe payment intent ID
  - `reason`: Description of the transfer
- On failure: sends notification to trainer about onboarding/account issue
- Logs transfer status

**Modified webhook handler - `invoice.payment_succeeded` (subscription payments):**
- Processes recurring subscription payments
- After payment record is created/updated
- Transfers to trainer if `productOrder.trainerId` exists
- Handles recurring payments the same way as one-time

**New controller action - `checkTrainerPaymentStatus()`:**
- Endpoint to check if a trainer is ready to receive payments
- Route: `GET /payment/trainer/payment-status/:trainerId`
- Returns trainer's payment readiness status
- Useful for frontend validation before showing payment options

#### 3. **Trainer Payment Readiness Middleware** (`src/app/middlewares/checkTrainerPaymentReadiness.ts`)
- Optional middleware for routes involving trainer payments
- Validates trainer payment readiness
- Non-blocking (doesn't prevent request if check fails)
- Logs warnings for investigation
- Can be applied to order creation routes

#### 4. **Payment Routes Update** (`src/app/modules/payment/payment.routes.ts`)
```typescript
// Check trainer payment readiness
router.get(
  '/trainer/payment-status/:trainerId',
  auth(),
  paymentController.checkTrainerPaymentStatus,
);
```

## Data Flow

### One-Time Payment Process
```
1. User creates order for trainer's product
   └─> Order created with PENDING status
   
2. User completes Stripe checkout
   └─> checkout.session.completed webhook fired
   
3. Payment controller webhook handler:
   ├─> Update order status to COMPLETED
   ├─> Create payment record
   ├─> Increment product purchase count
   ├─> Transfer payment to trainer
   │   ├─> Validate trainer payment readiness
   │   ├─> Call Stripe transfers API
   │   └─> Log transfer result
   ├─> Send notifications to trainer & customer
   └─> Return success response
```

### Subscription Payment Process
```
1. User subscribes to trainer's product
   └─> Order created with subscription_id
   
2. Stripe charges recurring subscription
   └─> invoice.payment_succeeded webhook fired
   
3. Payment controller webhook handler:
   ├─> Find product order by subscription_id
   ├─> Update order & subscription status
   ├─> Create/update payment record
   ├─> Transfer payment to trainer
   │   ├─> Validate trainer payment readiness
   │   ├─> Call Stripe transfers API
   │   └─> Log transfer result
   ├─> Update subscription end date
   └─> Send payment confirmation email
```

## Stripe Account Requirements

### For Trainers to Receive Payments
1. **Stripe Connected Account**: Created during onboarding
   - Stored in `User.stripeAccountId`
   - Type: Standard account (can be Express or Standard)

2. **Onboarding Requirements**:
   - All business information submitted
   - Banking details verified
   - `charges_enabled = true`
   - `payouts_enabled = true`
   - `onBoarding = true` (set in webhook when account.updated)

3. **Account Status Check**:
   ```typescript
   const account = await stripe.accounts.retrieve(stripeAccountId);
   assert(account.charges_enabled === true);
   assert(account.payouts_enabled === true);
   ```

## Transfer Process

### Stripe Transfer API
```typescript
const transfer = await stripe.transfers.create({
  amount: 10000, // Amount in cents ($100.00)
  currency: 'usd',
  destination: trainerStripeAccountId, // Connected account ID
  metadata: {
    orderId,
    trainerId,
    paymentIntentId,
    reason,
  },
  description: `Payment transfer for order ${orderId}`,
});
```

**Notes:**
- Transfers are instant to connected accounts
- No additional fees for transfers
- Transfer uses platform's Stripe balance
- Trainer receives funds in their connected account

## Error Handling

### Transfer Failures
When `transferToTrainerAccount()` fails:

1. **Trainer not found**: 
   - Returns error message
   - Order remains COMPLETED

2. **Onboarding not complete**:
   - Returns error message
   - Sends notification to trainer to complete onboarding
   - Order remains COMPLETED

3. **Stripe account not connected**:
   - Returns error message
   - Sends notification to trainer
   - Order remains COMPLETED

4. **Transfer API error**:
   - Logs error details
   - Returns error message
   - Notifies trainer to contact support

### Logging
All transfers are logged with:
- `console.log()` for success
- `console.error()` for failures
- Transfer ID, trainer name, and amount included
- Timestamps recorded in transfer metadata

## API Endpoints

### Check Trainer Payment Status
```
GET /payment/trainer/payment-status/:trainerId
Authorization: Bearer {token}

Response (Ready):
{
  "ready": true,
  "trainerName": "John Doe",
  "stripeAccountId": "acct_xxxxx"
}

Response (Not Ready):
{
  "ready": false,
  "reason": "Trainer has not completed Stripe onboarding",
  "accountStatus": {
    "chargesEnabled": false,
    "payoutsEnabled": false
  }
}
```

## Database Schema

### User Model Updates
Already has required fields:
- `stripeAccountId`: Trainer's Stripe connected account ID
- `onBoarding`: Boolean flag for onboarding completion status
- `stripeAccountUrl`: URL for onboarding link (cleared after completion)

### No Schema Changes Required
The implementation uses existing fields:
- `Order.trainerId`: Foreign key to trainer User
- `Payment` model: Existing fields sufficient
- `User.stripeAccountId`: Already present

## Migration Steps

### 1. Deploy Code Changes
```bash
# Update payment controller and add utility functions
# Update payment routes
# Add middleware if needed
```

### 2. Verify Stripe Configuration
```bash
# Ensure webhook endpoint handles:
# - account.updated (for trainer onboarding)
# - checkout.session.completed (for one-time payments)
# - invoice.payment_succeeded (for subscriptions)
```

### 3. Test with Sample Data
```bash
# 1. Create test trainer with Stripe account
# 2. Create test product assigned to trainer
# 3. Create order as member user
# 4. Complete payment via Stripe
# 5. Verify transfer to trainer account
# 6. Check payment records in DB
```

### 4. Monitor Webhooks
```bash
# Check logs for:
# - "💸 Initiating trainer payment transfer"
# - "✅ Transfer successful" or "❌ Transfer failed"
# - Transfer ID and amount
```

## Testing Checklist

### Pre-Production Testing
- [ ] Trainer completes Stripe onboarding (onBoarding = true)
- [ ] Verify stripeAccountId is set on trainer account
- [ ] Create test product assigned to trainer
- [ ] Place order as member user
- [ ] Complete Stripe payment
- [ ] Verify webhook fires (check logs)
- [ ] Confirm transfer created to trainer account
- [ ] Check Stripe dashboard for transfer status
- [ ] Verify notifications sent to trainer
- [ ] Test with incomplete onboarding (should fail gracefully)
- [ ] Test subscription renewals

### Production Safety
- [ ] Run on small test batch first
- [ ] Monitor error logs and webhooks
- [ ] Verify transfers appear in Stripe dashboard within 24 hours
- [ ] Have support process for trainer transfer issues

## Troubleshooting

### Transfer Not Found in Stripe Dashboard
**Causes:**
- Transfer ID incorrect in logs
- Trainer's Stripe account ID wrong
- Transfer failed silently

**Solution:**
```typescript
// Check transfer status
const transfer = await stripe.transfers.retrieve(transferId);
console.log(transfer.status); // 'succeeded' or 'failed'
```

### Trainer Can't Receive Funds
**Causes:**
- `onBoarding = false`
- `stripeAccountId = null`
- Account charges_enabled or payouts_enabled is false

**Solution:**
```typescript
// Check webhook account.updated fired
// Verify stripeAccountUrl was cleared after onboarding
// Check Stripe account status at stripe.com/connect
```

### Trainer Account Details
**To verify in Stripe Dashboard:**
1. Go to Stripe Connect
2. Find connected account by ID or trainer email
3. Check Account Status
4. Verify charges_enabled and payouts_enabled
5. Check bank details under Financial Accounts

## Performance Considerations

### Transfer Speed
- Transfers to connected accounts: **Instant** (within seconds)
- No additional API rate limits
- Fire-and-forget pattern (non-blocking)

### Database
- No new database tables required
- Minimal additional queries
- Transfer metadata stored in Stripe (not DB)

### Async Operations
- Transfers happen after payment webhook processing
- Failures don't block order completion
- Notifications sent separately after transfer

## Security Considerations

### Trainer ID Validation
```typescript
// Verify trainer exists
const trainer = await prisma.user.findUnique({
  where: { id: trainerId }
});
assert(trainer !== null);
```

### Amount Validation
```typescript
// Verify amount is positive
assert(amount > 0);

// Amount comes from Stripe checkout session
// Verified by Stripe signature on webhook
```

### Stripe Account Verification
```typescript
// Validate account is in good standing
const account = await stripe.accounts.retrieve(stripeAccountId);
assert(account.charges_enabled === true);
assert(account.payouts_enabled === true);
```

## Monitoring & Alerts

### Key Logs to Monitor
```
💸 Initiating trainer payment transfer for order {orderId}
✅ Transfer successful - Transfer ID: {transferId}
❌ Transfer failed: {reason}
```

### Dashboard Queries
```sql
-- Find orders with trainers
SELECT * FROM orders WHERE trainerId IS NOT NULL AND paymentStatus = 'COMPLETED';

-- Check trainer onboarding status
SELECT id, fullName, email, onBoarding, stripeAccountId FROM users WHERE role = 'TRAINER';

-- Payment records by trainer
SELECT p.* FROM payments p
JOIN orders o ON p.orderId = o.id
WHERE o.trainerId = {trainerId};
```

## Future Enhancements

1. **Transfer Fee Structure**: Add configurable platform fees
2. **Payout Schedule**: Control when trainers receive funds
3. **Transfer Reports**: Dashboard showing transfer history
4. **Retry Logic**: Automatic retry for failed transfers
5. **Transfer Reversals**: Handle refunds by reversing transfers
6. **Multi-Currency**: Support international trainer payments
7. **Payout Limits**: Set minimum transfer thresholds

## References

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe Transfers API](https://stripe.com/docs/api/transfers)
- [Stripe Webhook Events](https://stripe.com/docs/api/events)
- [Stripe Account Objects](https://stripe.com/docs/api/accounts)

## Support

For issues or questions about trainer payment transfers:

1. Check logs for transfer success/failure messages
2. Verify trainer Stripe account status in Stripe dashboard
3. Confirm webhook signature validation passed
4. Review error messages for specific issues
5. Contact Stripe support for account-level issues

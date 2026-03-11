# Referral Code Discount Implementation

## Overview
This document explains how the referral code discount system works during checkout using Stripe.

## Flow

### 1. **Trainer Clicks "Use" Button (Validation & Preview)**
When a trainer wants to use a referral code, they first validate it to see the discount amount.

**Endpoint:** `POST /api/applied-referral/validate`

**Request Body:**
```json
{
  "referralCode": "JOH-A1B2C3D4"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Referral code is valid",
  "data": {
    "valid": true,
    "referralCode": "JOH-A1B2C3D4",
    "discountAmount": 10,
    "referredBy": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "message": "You will get $10 off your subscription"
  }
}
```

**Frontend Calculation:**
- Original Price: $50
- Discount: $10
- **Final Price: $40**

### 2. **Trainer Proceeds to Checkout**
The trainer then creates a checkout session with the referral code.

**Endpoint:** `POST /api/user-subscription/create-checkout-session`

**Request Body:**
```json
{
  "subscriptionOfferId": "subscription_offer_id_here",
  "referralCode": "JOH-A1B2C3D4"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Checkout session created successfully",
  "data": {
    "sessionId": "cs_test_...",
    "url": "https://checkout.stripe.com/...",
    "appliedDiscount": {
      "type": "referral",
      "code": "JOH-A1B2C3D4",
      "discountAmount": 10,
      "originalPrice": 50,
      "discountedPrice": 40
    }
  }
}
```

### 3. **Stripe Checkout**
The trainer is redirected to Stripe checkout where they pay the discounted amount ($40).

**How Discount is Applied:**
- A Stripe coupon is automatically created/retrieved for the referral code
- The coupon has `amount_off: 1000` (in cents) = $10 off
- Stripe applies this discount to the subscription checkout
- The coupon is set to `duration: 'once'` (applies only to first payment)

### 4. **Payment Success & Webhook**
When payment succeeds, Stripe sends a webhook event.

**Webhook Event:** `customer.subscription.created`

**Automatic Processing:**
1. Creates `UserSubscription` record in database
2. Generates a unique referral code for the new subscriber
3. If a referral code was used, creates an `AppliedReferral` record with status `APPLIED`
4. Records pricing rule usage if applicable

## Key Features

### Automatic Referral Code Generation
After successful subscription, a unique referral code is automatically generated:
- Format: `{FIRST_3_LETTERS}-{LAST_8_CHARS_OF_USER_ID}`
- Example: `JOH-A1B2C3D4` for user "John"
- Stored in `Referral` table

### Validation Rules
1. **Referral code must exist** in the database
2. **Cannot use your own referral code**
3. **Cannot use the same referral code twice**
4. **Pricing rules and referral codes cannot be combined** - referral takes priority

### Database Models

#### Referral
```prisma
model Referral {
  id             String   @id @default(auto())
  userId         String
  referralCode   String   @unique
  stripeCouponId String?  // Auto-created when first used
  createdAt      DateTime
  updatedAt      DateTime
}
```

#### AppliedReferral
```prisma
model AppliedReferral {
  id         String                @id @default(auto())
  userId     String
  referralId String
  status     AppliedReferralStatus @default(PENDING)
  createdAt  DateTime
  updatedAt  DateTime
}
```

#### referralRewardSettings
```prisma
model referralRewardSettings {
  id           String   @id @default(auto())
  userId       String
  rewardAmount Float    @default(0)  // e.g., 10 for $10 discount
  createdAt    DateTime
  updatedAt    DateTime
}
```

## API Endpoints

### 1. Validate Referral Code
```
POST /api/applied-referral/validate
Headers: Authorization: Bearer <token>
Body: { "referralCode": "CODE" }
```

### 2. Create Checkout Session (with optional referral)
```
POST /api/user-subscription/create-checkout-session
Headers: Authorization: Bearer <token>
Body: { 
  "subscriptionOfferId": "id",
  "referralCode": "CODE"  // optional
}
```

### 3. Get Applied Referrals
```
GET /api/applied-referral/
Headers: Authorization: Bearer <token>
```

## Error Handling

### Common Errors
1. **Invalid Referral Code**
   - Status: 404
   - Message: "Invalid referral code"

2. **Own Referral Code**
   - Status: 400
   - Message: "You cannot apply your own referral code"

3. **Already Applied**
   - Status: 400
   - Message: "You have already applied this referral code"

4. **Referral Settings Not Found**
   - Status: 404
   - Message: "Referral reward settings not configured"

## Configuration

### Set Referral Reward Amount
Create a record in `referralRewardSettings`:
```javascript
await prisma.referralRewardSettings.create({
  data: {
    userId: adminUserId,
    rewardAmount: 10  // $10 discount
  }
});
```

## Testing Flow

1. **Setup:**
   - Create a trainer account (User A)
   - Subscribe User A to get their referral code
   - Create another trainer account (User B)

2. **Test Validation:**
   ```bash
   POST /api/applied-referral/validate
   { "referralCode": "USER_A_CODE" }
   ```

3. **Test Checkout:**
   ```bash
   POST /api/user-subscription/create-checkout-session
   {
     "subscriptionOfferId": "offer_id",
     "referralCode": "USER_A_CODE"
   }
   ```

4. **Complete Payment:**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Complete checkout

5. **Verify:**
   - Check `AppliedReferral` table for status `APPLIED`
   - Verify User B got their own referral code
   - Verify discount was applied in Stripe

## Code Locations

### Main Service Functions
- `userSubscription.service.ts`:
  - `processReferralCodeDiscount()` - Validates and processes referral
  - `createCheckoutSessionInStripe()` - Creates Stripe checkout with discount
  - `createUserSubscriptionFromWebhook()` - Generates referral code after payment

### Controllers
- `appliedReferral.controller.ts`:
  - `validateReferralCode()` - Preview discount endpoint

### Webhook Handler
- `payment.controller.ts`:
  - `handleWebHook()` case `customer.subscription.created` - Applies referral status

## Notes

- Referral codes are **automatically generated** when a trainer subscribes
- The discount is **applied once** per referral code per user
- The system uses **Stripe coupons** to apply discounts
- Frontend should make the calculation: `originalPrice - discountAmount`
- The actual payment amount is handled by Stripe with the coupon applied

# Payment Gateway Integration Guide

This guide explains how to integrate payment gateways with the ConnectLocal Marketplace app to handle both card payments and local payment methods.

## Overview

The application supports multiple payment methods:
- **Credit/Debit Cards** - Via Stripe
- **UPI** - Via Razorpay
- **Bank Transfer** - Via Razorpay (pending)
- **Cash on Delivery (COD)** - Direct order placement

## Part 1: Setting Up Stripe (Credit/Debit Card Payments)

### Step 1: Create a Stripe Account
1. Go to [stripe.com](https://stripe.com)
2. Click "Sign up" and create an account
3. Complete email verification and basic details
4. Dashboard will open with API keys

### Step 2: Get Your API Keys
1. In Stripe Dashboard, go to **Developers** → **API Keys**
2. Find "Publishable key" and "Secret key"
3. Copy both keys (keep Secret key private!)

### Step 3: Add Keys to Environment Variables
1. In your Vercel project settings (or `.env.local` for local development):
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
```

### Step 4: Install Stripe SDK
```bash
npm install stripe @stripe/react-stripe-js
```

### Step 5: Create Stripe Payment Handler
Create a file: `/src/lib/stripe-config.ts`

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function createPaymentIntent(amount: number, email: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      receipt_email: email,
      metadata: {
        customer_email: email,
      },
    });
    
    return {
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}
```

## Part 2: Setting Up Razorpay (UPI & Bank Transfer)

### Step 1: Create Razorpay Account
1. Go to [razorpay.com](https://razorpay.com)
2. Sign up for a business account
3. Complete KYC verification (required for live payments)

### Step 2: Get API Keys
1. Log in to Razorpay Dashboard
2. Go to **Settings** → **API Keys**
3. Copy Key ID and Key Secret

### Step 3: Add Keys to Environment Variables
```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Install Razorpay SDK
```bash
npm install razorpay
```

### Step 5: Create Razorpay Payment Handler
Create a file: `/src/lib/razorpay-config.ts`

```typescript
import Razorpay from 'razorpay';

export const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export interface OrderParams {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export async function createRazorpayOrder(params: OrderParams) {
  try {
    const options = {
      amount: Math.round(params.amount * 100), // Convert to paise
      currency: params.currency || 'INR',
      receipt: params.receipt,
      notes: params.notes || {},
    };

    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw error;
  }
}
```

## Part 3: Create Payment Processing Route

Create a file: `/src/app/api/checkout/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/stripe-config';
import { createRazorpayOrder } from '@/lib/razorpay-config';

export async function POST(request: NextRequest) {
  try {
    const { amount, email, paymentMethod, orderId } = await request.json();

    if (paymentMethod === 'credit_debit') {
      // Stripe payment
      const paymentIntent = await createPaymentIntent(amount, email);
      return NextResponse.json({
        success: true,
        provider: 'stripe',
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.id,
      });
    } else if (paymentMethod === 'upi' || paymentMethod === 'bank_transfer') {
      // Razorpay payment
      const order = await createRazorpayOrder({
        amount: amount,
        currency: 'INR',
        receipt: orderId,
        notes: { orderId },
      });

      return NextResponse.json({
        success: true,
        provider: 'razorpay',
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      });
    } else if (paymentMethod === 'cod') {
      // Cash on Delivery - no payment processing needed
      return NextResponse.json({
        success: true,
        provider: 'cod',
        message: 'Order confirmed. Payment will be collected on delivery.',
      });
    }

    return NextResponse.json(
      { error: 'Invalid payment method' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment processing failed' },
      { status: 500 }
    );
  }
}
```

## Part 4: Create Webhook Handler for Payment Verification

Create a file: `/src/app/api/webhooks/stripe/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe-config';
import { db } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  try {
    const event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;
      const orderId = paymentIntent.metadata.orderId;

      // Update order status in Firestore
      if (orderId) {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'Payment Confirmed',
          paymentId: paymentIntent.id,
          paymentDate: new Date(),
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }
}
```

## Part 5: Update Guest Checkout for Payments

In the `GuestCheckoutForm` component, integrate payment processing:

```typescript
const handlePaymentSubmit = async (guestData: GuestCheckoutData) => {
  try {
    // Create order first
    const orderId = uuidv4();
    
    // Process payment based on method
    if (guestData.paymentMethod === 'cod') {
      // Direct order creation for COD
      await handleGuestCheckout(guestData);
    } else {
      // Call payment endpoint
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: subtotal + 5.00,
          email: guestData.email,
          paymentMethod: guestData.paymentMethod,
          orderId: orderId,
        }),
      });

      const paymentData = await response.json();

      if (paymentData.provider === 'stripe') {
        // Redirect to Stripe checkout
        redirectToStripeCheckout(paymentData.clientSecret);
      } else if (paymentData.provider === 'razorpay') {
        // Open Razorpay checkout
        openRazorpayCheckout(paymentData.orderId, guestData);
      }
    }
  } catch (error) {
    toast({
      title: 'Payment Error',
      description: 'Failed to process payment',
      variant: 'destructive',
    });
  }
};
```

## Part 6: Environment Variables Summary

Add these to your `.env.local` (local development) and Vercel project settings:

```env
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

## Part 7: Testing

### Test Cards (Stripe):
- **Visa**: 4242 4242 4242 4242
- **Mastercard**: 5555 5555 5555 4444
- Expiry: Any future date
- CVC: Any 3 digits

### Test Mode (Razorpay):
- Use test API keys from dashboard
- All test transactions are simulated

## Production Checklist

- [ ] Switch to live API keys
- [ ] Set up webhook endpoints
- [ ] Test payment workflows end-to-end
- [ ] Enable SSL/HTTPS
- [ ] Configure email notifications
- [ ] Set up monitoring and alerts
- [ ] Document payment process for support team

## Support

For issues with specific payment providers:
- **Stripe Support**: https://support.stripe.com
- **Razorpay Support**: https://razorpay.com/support

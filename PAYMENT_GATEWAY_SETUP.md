# Payment Gateway Setup

ConnectLocal uses a server-side payment adapter model.

## Supported methods

- Cash on Delivery — available immediately.
- Stripe — Checkout Session adapter included; use sandbox keys first.
- PayPal — Orders API adapter included; use the sandbox API base first.
- JazzCash — adapter slot included; merchant API credentials and exact signing/field contract are required before activation.
- Easypaisa — adapter slot included; merchant API credentials and exact signing/field contract are required before activation.

Debit/credit card details are never stored by ConnectLocal. Card processing is delegated to an eligible provider.

## Stripe

Set:

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

Configure the provider webhook to call:

```text
/api/payments/stripe/webhook
```

The webhook verifies the Stripe signature before changing an order to `paid`.

## PayPal

Set:

```text
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

After sandbox testing, change the API base and credentials for the production merchant account.

## JazzCash / Easypaisa

Do not invent request fields, hashes, callback URLs or merchant identifiers. Their integration depends on the merchant agreement and API contract supplied to the business. Put the adapter behind the payment service and keep secrets server-side.

## Core security rule

The browser can request a payment, but it can never declare a payment successful. Only a verified provider callback/webhook may change an online order to `paid`.

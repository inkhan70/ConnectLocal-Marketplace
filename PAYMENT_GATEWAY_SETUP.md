# Payment Gateway Setup

ConnectLocal uses a server-side payment adapter model.

## Supported methods

- Cash on Delivery — available immediately.
- Stripe — Checkout Session adapter included; use sandbox keys first.
- PayPal — Orders API adapter included; use the sandbox API base first.
- Safepay (PKR) — checkout + signed webhook included; see below.
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

## Safepay (PKR)

Set (Vercel -> Settings -> Environment Variables), using Safepay **sandbox** values first:

```text
SAFEPAY_SECRET_KEY=...            # merchant secret key
SAFEPAY_PUBLIC_KEY=...            # merchant API key (sec_...)
SAFEPAY_WEBHOOK_SECRET=...        # Safepay dashboard -> Developers -> Endpoints -> "View shared secret"
SAFEPAY_API_BASE_URL=https://sandbox.api.getsafepay.com   # live: https://api.getsafepay.com
PLATFORM_FEE_PERCENT=0            # optional commission on goods, 0-50 (default 0)
```

In the Safepay dashboard add a webhook endpoint pointing to `https://YOUR-DOMAIN/api/payments/safepay/webhook`.
Safepay is offered at checkout only when all three secrets are present, because **the webhook is the only thing that
marks a Safepay order paid** (signature `X-SFPY-SIGNATURE` = HMAC-SHA512 of the raw body; amount and currency are checked
against the order). The seller's `currencyCode` must be `PKR`. See `docs/TESTING_PAYMENTS.md` to test it end to end.

## Member earnings and payouts

Online payments (Stripe / PayPal / Safepay) are collected by the platform. Each one has a ledger row
(`paymentTransactions`). Money is **held** until the order is delivered / picked up, then **available**, then the admin pays
the member (bank / JazzCash / Easypaisa / Raast) and records the transfer reference at `/admin/payouts` (**paid out**).
Members add payout details and see balances at `/dashboard/earnings`. Cash on Delivery is collected by the seller and is
not part of this ledger. Payout transfers are made by you outside the app; the app records them and prevents paying twice.

## JazzCash / Easypaisa

Do not invent request fields, hashes, callback URLs or merchant identifiers. Their integration depends on the merchant agreement and API contract supplied to the business. Put the adapter behind the payment service and keep secrets server-side.

## Core security rule

The browser can request a payment, but it can never declare a payment successful. Only a verified provider callback/webhook may change an online order to `paid`.

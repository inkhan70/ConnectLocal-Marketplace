# ConnectLocal Marketplace — Production Implementation

## What changed

- Server-authoritative checkout: the browser no longer writes orders directly.
- Server validates product existence, seller ownership, live prices and stock.
- Atomic inventory reservation/decrement prevents overselling.
- Seller delivery settings: base fee, per-km fee, free-delivery threshold and maximum fee.
- Customer pickup has zero delivery fee.
- Delivery fee and order totals are locked into the order at checkout.
- Secure server-generated 8-character pickup code.
- Pickup verification is server-side and completes the transaction only after the seller verifies the buyer's code.
- Explicit order state machine prevents arbitrary status jumps.
- Buyer cancellation and refund-request rules.
- Admin refund approval/rejection flow.
- Payment states are separated from fulfillment states.
- COD is supported immediately.
- Stripe sandbox/production Checkout Session adapter is included.
- PayPal sandbox/production order creation adapter is included.
- JazzCash/Easypaisa are represented as provider adapters but require merchant-specific API/signature configuration before activation.
- Stripe webhook signature verification is included.
- Generic normalized payment webhook is included for other providers.
- In-app order notifications are created server-side.
- Admin role/permission changes and Auth deletion use Firebase Admin SDK.
- Admin custom claims are synchronized for Storage rules.
- Firestore rules prevent direct client order creation/update/deletion.
- Chat message rules now correctly resolve participants from the parent chat.
- Product owner cannot change product ownership through a client update.
- Low-stock threshold is stored per product.

## Important payment rule

Never mark an online payment as `paid` from the browser. Provider webhooks are authoritative. A payment order may remain `pending_payment` until the provider confirms it.

## Required server configuration

Copy `.env.example` to `.env.local` for development and set the server-only credentials. Do not commit `.env.local`, service-account JSON, payment secrets or webhook secrets.

For production, configure the same secrets in the hosting provider's secret/environment configuration.

## Firestore deployment

Deploy:

```bash
firebase deploy --only firestore:rules,storage
```

The exact Firebase CLI command can vary with the Firebase project configuration.

## Development

```bash
npm ci
npm run dev
```

## Production build

```bash
npm ci
npm run build
npm start
```

## Order lifecycle

```text
Checkout
  -> pending_payment (online)
  -> paid (provider webhook)
  -> processing
  -> ready_for_pickup OR out_for_delivery
  -> completed
```

COD skips the external payment confirmation and begins as `paid` with `paymentStatus=cod_pending`.

### Pickup

```text
paid -> processing -> ready_for_pickup -> seller verifies buyer code -> completed
```

The same pickup code is visible to buyer and seller, but only the server can validate it and change the order state.

### Seller delivery

```text
paid -> processing -> out_for_delivery -> delivered -> buyer confirms -> completed
```

## Refund lifecycle

```text
eligible order
  -> refund_requested
  -> admin decision
       -> refund_approved -> provider refund confirmation -> refunded
       OR
       -> refund_rejected
```

A refund approval does not claim that money has returned until the payment provider confirms it.

## Multi-seller cart

The current production-safe checkout deliberately requires one seller per checkout. This avoids ambiguous shipping, split-payment and split-refund behavior. A future multi-seller checkout can create one child order per seller after a dedicated settlement design is added.

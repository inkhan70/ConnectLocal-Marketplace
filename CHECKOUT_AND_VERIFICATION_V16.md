# Checkout, payments, verification key and service form (v16)

Verified: strict `tsc` clean, 57 unit tests pass, `next build` succeeds.

## 1. Payment options (why only "Cash on Delivery" showed)
- Guests were hard-wired to COD (form schema `z.literal("cod")`, and the server refused guest online payment).
- Signed-in buyers were offered 5 methods, two of which (JazzCash, Easypaisa) cannot work yet.
- Now `GET /api/payments/methods` reports what this deployment can really process:
  Cash on Delivery always; **Credit/Debit Card (Stripe)** when `STRIPE_SECRET_KEY` is set; **PayPal** when `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` are set.
  Cart and guest checkout both use it. The server also rejects methods that are not enabled.
- **Guests can pay online.** Each guest order gets a secret *guest key* (shown once, stored only as a hash). It authorises payment, the tracking page and the verification code for that order.
- **PayPal never completed before** (no capture step). New `POST /api/payments/paypal/capture` captures server-side after PayPal returns the customer, verifies amount/currency/reference, then marks the order paid.
- Stripe/PayPal return URLs: guests return to `/track-order`, members to `Dashboard -> Orders`.

## 2. Verification key (handover code)
- Every order gets a private 8-character code. It is stored in `orderSecrets/{orderId}` (Firestore rules deny all client access), **not** on the order, so sellers can no longer read it.
- Buyer: Dashboard -> Orders -> **Show code**. Guest: the `/track-order` page. Both read it through the server (`/api/orders/{id}/verification`), never the seller or admin.
- Seller completes **pickup or delivery** with *Verify pickup / Verify delivery* by typing the code the buyer tells them (action `verify_handover`). The seller can no longer mark a new order "delivered" without it; 5 wrong codes lock verification.
- Guests can track status, pay and see their code at `/track-order?orderId=...&k=...` (link is private; recent guest orders are remembered on the device).
- Legacy orders that still carry `pickupCode` keep working.

## 3. Add-product form per business type
- Service providers (role "services" or services dashboard: doctors, dentists, therapists, repair services...) get **Add a New Service**: service wording, "Service Options & Fees", no inventory/low-stock fields, listings never limited by stock (`trackInventory: false`).
- Shopkeepers, wholesalers, clinics, food, automotive etc. keep the original form exactly as before. The category field shows its readable name instead of the raw key.

## Deploy checklist
1. Publish `firestore.rules` (adds `orderSecrets`).
2. Vercel env for card payments: `STRIPE_SECRET_KEY` (+ `STRIPE_WEBHOOK_SECRET`, webhook -> `/api/payments/stripe/webhook`). For PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE` (sandbox default; live: `https://api-m.paypal.com`).
3. Redeploy, then open `/api/payments/methods` to confirm the options you expect.

## Not changed
- JazzCash / Easypaisa stay hidden until their adapters exist.
- Guests cannot cancel or request refunds online (they contact the seller); members can.
- Code verification protects the handover; existing orders created before this version keep their old code on the order until completed.

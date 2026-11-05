# Testing payments (members dashboard) - step by step

## 0. What is offered?
Open `https://YOUR-SITE/api/payments/methods`. You should see `cod`, plus `safepay` / `stripe` / `paypal` only for providers whose
secrets are set. If Safepay is missing, one of `SAFEPAY_SECRET_KEY`, `SAFEPAY_PUBLIC_KEY`, `SAFEPAY_WEBHOOK_SECRET` is not set
(redeploy after changing env vars).

## 1. Cash on Delivery (no setup)
1. Sign in as a **buyer** (member A). Add a product from **another** member B to the cart (you cannot buy from yourself, and one order = one seller).
2. Checkout -> Cash on Delivery -> order is created as `paid`/`cod_pending`.
3. As member B: Dashboard -> Orders -> process it -> verify handover with the buyer's code (Buyer: Orders -> Show code).
4. COD does **not** appear in Earnings (the seller collects the cash).

## 2. Safepay sandbox (PKR) - the local payment
Prerequisites: seller B's profile currency is `PKR`; env vars from `PAYMENT_GATEWAY_SETUP.md` are set; webhook endpoint added in the Safepay sandbox dashboard.
1. Buyer A: checkout -> **Safepay** -> you are redirected to the Safepay sandbox page. Copy the `beacon=track_...` value from its URL (this is the order's tracker).
2. Pay with Safepay's sandbox test credentials (from your Safepay sandbox dashboard).
3. Safepay calls the webhook -> the order becomes **paid** (Orders page updates by itself; the page shows "Confirming your payment" until then).
4. If the webhook cannot reach your machine, simulate it (works against localhost or a Vercel preview):
   ```bash
   SAFEPAY_WEBHOOK_SECRET=<your shared secret> \
   node scripts/simulate-safepay-webhook.cjs --tracker track_xxx --amount 1000.00 --url http://localhost:3000
   ```
   Expected: `200 {"received":true,"changed":true}`. Run it again -> `changed:false` (retries are safe). Use a wrong `--amount` -> the
   order stays `pending_payment` and is flagged `paymentMismatch`.
5. Wrong signature (change one character of the secret) -> `401`.

## 3. Earnings and payout
1. Member B: Dashboard -> **Earnings**. After step 2 the amount shows under **On hold**. Add payout details (IBAN or 03XX mobile).
2. Member B marks the order out for delivery / ready for pickup, then the handover is verified with the buyer's code -> amount moves to **Ready to pay out**.
3. Admin: **Member Payouts** -> the member shows with the full payout details -> make the transfer in your bank/JazzCash app -> enter the transfer reference -> **Mark as paid**.
4. Member B: Earnings -> **Paid out so far** increases and the payout appears in history. Marking again pays nothing (409): no double payment.
5. Refund test: refund an order **before** payout -> its amount disappears from held/available. Refund **after** payout -> it appears under "Refunded after payout" for you to recover.

## 4. Stripe / PayPal
Use sandbox keys. Stripe: `stripe listen --forward-to localhost:3000/api/payments/stripe/webhook` and test card `4242 4242 4242 4242`.
PayPal: sandbox buyer account; the customer is captured server-side when returning to the site.

## 5. Automated checks
`npm test` includes the signature check, the amount/currency check, webhook-retry safety, the ledger and the earnings/payout rules.

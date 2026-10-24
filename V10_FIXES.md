# v10 — bug-fix pass

Verified with: `npx tsc --noEmit` (0 errors, was 16), `npx jest` (13/13), `next build` (succeeds).

## Compile errors fixed
- AuthContext `user` type lacked `getIdToken` (broke 5 files).
- `api/orders`: Map/getAll typing. `api/payments/*`: typing. `GuestCheckoutForm`: resolver type mismatch. `PlanForm`: `null` input value.

## Security
- **firestore.rules `users` create**: anyone could self-create a profile with `isAdmin: true`, a paid plan, Ghost Coins or balance. Now constrained to safe defaults.
- **admin-setup page** shipped a hard-coded key (`ADMIN_SETUP_KEY_2024`) in the browser bundle and wrote `isAdmin` from the client (blocked by rules anyway). Now calls `/api/admin/setup`, which checks `ADMIN_SETUP_KEY` on the server (timing-safe).
- Chat rules: `senderId` must equal the signed-in user; `participants` can no longer be edited.
- Products API: server-side validation (negative prices/inventory, status whitelist, path-safe ids — variety ids were used in storage paths).

## Order / payment logic
- Sellers could set any valid transition, incl. `paid` (without payment), `refund_approved`/`refunded` (self-approving refunds) and `picked_up`/`completed` (skipping pickup-code check and Ghost Coin award). Manual transitions are now limited to processing / ready_for_pickup / out_for_delivery / delivered / cancelled, with delivery-method checks.
- Seller cancel never restored stock; now shared `cancelAndRestoreStock` (transactional).
- Buyer cancelling an online-paid order lost their money; now directed to the refund flow.
- Added `mark_refunded` (admin, COD) so approved refunds can finish; Stripe `charge.refunded` completes online refunds.
- Stripe webhook: retried events reset in-progress orders back to `paid`; expired sessions cancelled orders without returning stock; amount/currency were not verified; delayed payments were treated as paid. Rewritten on a shared idempotent `applyPaymentEvent` (also used by the generic webhook). A payment arriving for a cancelled order is flagged `needsRefund`.
- Orders: currency was always `USD` (client never sent it) so PKR prices were charged as USD → now the seller's currency; seller pickup/delivery switches are enforced; self-purchase blocked (Ghost Coin farming).
- Cart: Stripe `checkoutUrl` was never opened (only PayPal redirected).
- Notifications are best-effort and can no longer turn a committed action into a 500.

## Admin / subscriptions
- `/api/admin/setup` double-initialised firebase-admin and returned 503 when the shared helper had initialised first.
- Role change now updates `dashboardType`; user delete archives their listings and tolerates a missing Auth account; admin claim merge keeps other claims.
- Subscription grant: invalid dates returned 500 (now 400).
- Stripe subscription checkout sent both `customer` and `customer_email` (Stripe rejects) for returning customers; free-plan switch while a paid Stripe subscription is active is blocked.
- `past_due` / `cancelled` subscriptions kept paid-plan quotas (only dates were checked).
- Auth failures now return 401 instead of 500 across API routes.

## Known gaps (not changed — need a product decision)
- `users` documents are publicly readable (needed for the directory) and include email/Stripe ids; split into a public profile doc.
- Account balance from Ghost Coin conversion is shown as "available for your next purchase" but checkout never spends it.
- `pending_payment` orders that never start a payment keep their stock reserved indefinitely; add a scheduled expiry job.
- Delivered orders need buyer confirmation; add an auto-complete timeout.
- JazzCash/Easypaisa remain placeholders (as documented). No ESLint config; `src/package.json`, `workspace/`, `studio/` are stale copies.
- Firestore rules were edited but could not be run against the emulator here — please run `firebase emulators:exec` before deploying.

---
# Admin bootstrap security patch (on top of v10)

- New `POST /api/profile/bootstrap` (verified ID token only). First verified user of an uninitialised system becomes admin via the Admin SDK inside one Firestore transaction on `config/bootstrap` (race-safe). If any admin already exists, nobody is auto-promoted. Existing Auth claims are merged, not replaced. Existing users/data are never reset.
- Email signup, sign-in (missing profile), Google signup/login and the select-role self-heal all use it; clients no longer write profiles or `isAdmin`.
- `createDefaultUserProfile` now always writes `isAdmin: false`.
- Firestore rules: stricter `users` create + longer update denylist (isAdmin, permissions, subscription*, balance, Ghost Coin fields, audit, ...).
- Email/password users must have a VERIFIED email to be promoted (so promotion happens on first sign-in after verification, not at signup).
- `/api/admin/setup` (server env `ADMIN_SETUP_KEY`) remains as a recovery path.

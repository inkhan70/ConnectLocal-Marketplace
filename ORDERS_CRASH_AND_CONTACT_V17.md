# Orders/Messages crash + WhatsApp contact flow (v17)

Verified: strict `tsc` clean, 76 unit tests pass, `next build` succeeds.

## 1. "Application error: a client-side exception" on Orders and Messages
Cause: both screens ran a Firestore query that filters on one field AND sorts on another
(`orders`: buyerId/businessId + orderDate, `chats`: participants + lastMessageTimestamp). Firestore requires a hand-made
*composite index* for that, the project had none, the query failed, and the app's error listener turned that into a
full-page crash. (Your Stripe payment itself was fine: the money shows in the Stripe balance; the crash was only the member screen.)

Fixed three ways:
- Orders and Messages now query by one field only and sort newest-first in the app, so they work with **no index setup**.
- In production a failed query now shows an error/empty state on that screen instead of crashing the whole app.
- New friendly `error.tsx` / `global-error.tsx` pages (Try again / Home) replace the bare Next.js error.
- Optional: `firestore.indexes.json` is included (and linked in `firebase.json`) if you later want the indexed queries.

## 2. WhatsApp / Call / SMS instead of in-app chat
- **Members enter their numbers** at sign-up (optional WhatsApp field) and in **Dashboard -> Settings -> Customer Contact**
  (WhatsApp number + optional separate phone for calls/SMS, live preview, "Test WhatsApp link").
- Numbers are accepted in any common format (`0300-1234567`, `+92 300 1234567`, `0092...`), checked, and stored as `+923001234567`.
  Local formats use the member's country; otherwise the country code is required. Junk is rejected, never saved.
- **Customers tap one button** on the storefront, product pages and distributor pages: **WhatsApp** (opens the seller's chat on
  the exact number with a ready message, e.g. the product name and link), **Call** and **SMS**. Works for guests (no login),
  on phones (WhatsApp app) and desktop (WhatsApp Web).
- Orders screen: buyers can contact the seller about an order; sellers can contact the buyer when a phone was given at checkout.
  The guest tracking page has a contact card too. The verification code is never put in a message.
- In-app chat remains only as a fallback for signed-in customers when a seller has not published a number.
- Public API publishes only validated contact numbers (never email or other private profile fields).

## Deploy
1. Redeploy. No Firebase console changes are needed for the crash fix.
2. Ask members to add their WhatsApp number in Settings (or at sign-up).
3. Stripe test payments: if an order stays "pending payment", check Stripe -> Developers -> Webhooks -> your endpoint
   (`/api/payments/stripe/webhook`) and the `STRIPE_WEBHOOK_SECRET` on Vercel.

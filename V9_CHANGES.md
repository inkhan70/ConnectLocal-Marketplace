# ConnectLocal v9 cumulative changes

## 1. Subscription access has two controlled paths

A paid membership can become active through:

1. **Payment** — Stripe subscription checkout + verified webhook.
2. **Administrator grant** — an authorized administrator assigns a configured plan with an optional end date.

Both paths use the same server-side entitlement model. Users cannot edit subscription fields directly in Firestore.

### Admin grant safeguards

- Admin grant/revoke uses a protected server API.
- Grant and revoke actions are recorded in `subscriptionAudit`.
- The audit collection is readable only by administrators.
- Start/end dates are validated server-side.
- A future grant is not treated as active until its start date.
- An administrator cannot overwrite or revoke an active payment-backed Stripe subscription through the manual-grant endpoint; payment billing must be managed through the payment path.
- The admin dashboard shows whether the current entitlement came from Payment, Admin grant, or System.

## 2. Member business sharing

Every authenticated business/service member gets a **Share your business** card in the dashboard.

It provides a compact public URL:

`/b/<business-id>`

The short route redirects to the canonical public business profile. Members can:

- copy the short link;
- use the device's native share sheet;
- send through WhatsApp;
- open the Messenger app share deep link when supported by the device;
- send by email.

The native share sheet is the cross-platform fallback for apps that do not expose a simple recipient-independent web share URL.

## 3. Regression correction

Product mutations remain server-authoritative. The dashboard product-delete action was changed from a direct Firestore delete to the protected `/api/products` DELETE endpoint so the security rules and UI remain consistent.

The DELETE endpoint removes product media/storage records and recalculates the member's listing and storage counters.

## 4. Validation performed

- 164 TypeScript/TSX source files transpiled with zero syntax diagnostics.
- Subscription date and quota runtime checks passed (including exact 400 MB boundary and over-limit rejection).
- Static assertions for admin subscription provenance, audit rules, share targets, and short-link redirect passed.
- Direct client-side product create/update/delete mutations were checked and none remain.

A complete `npm test` / `next build` requires the project's installed dependency tree. The supplied sandbox did not contain the Jest executable, and a live Firebase/Stripe integration test requires deployment credentials.

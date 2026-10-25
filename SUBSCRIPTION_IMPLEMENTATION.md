# ConnectLocal subscription implementation

## Recommended plans

| Plan | Price | Storage | Active images | Main value |
|---|---:|---:|---:|---|
| Community | $0 | 80 MB | 15 | Establish the business |
| Basic | $2/month | 400 MB | 100 | Visibility, leads, messaging, basic analytics |
| Plus | $4/month | 1 GB | 250 | Enhanced visibility, customer tools, analytics |
| Pro | $10/month | 5 GB included | Unlimited | Maximum business tools and visibility |

Storage/image quotas are infrastructure limits. Paid value is business growth: visibility, customer contact, lead tools, analytics and additional business functionality.

## Server authority

- Users cannot edit subscription entitlement fields directly through Firestore rules.
- Product create/update operations use `/api/products` so listing/image/storage quotas cannot be bypassed by direct client writes.
- Product images are processed server-side with Sharp and compressed to a maximum of 3 MB.
- Processed images are written to `mediaLibrary` with member type/category metadata and become available to the matching shared library.
- Paid subscription checkout uses Stripe Checkout in subscription mode.
- Stripe subscription events are handled by `/api/payments/stripe/webhook`.
- Admin assignment/removal uses `/api/admin/subscriptions/assign` rather than direct client profile mutation.

## First setup

1. Configure `FIREBASE_SERVICE_ACCOUNT_KEY` and `FIREBASE_STORAGE_BUCKET`.
2. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` if paid online billing is enabled.
3. Log in as an administrator.
4. Open Admin → Subscriptions → **Seed Recommended Plans**.
5. Configure the Stripe webhook to send checkout/session and customer/subscription events to `/api/payments/stripe/webhook`.
6. Test Community activation first, then Stripe test-mode Basic/Plus/Pro checkout.

## Important

The source package can statically validate the entitlement logic without live Firebase/Stripe credentials. A real payment test requires a configured Stripe test account and a deployed HTTPS webhook endpoint.

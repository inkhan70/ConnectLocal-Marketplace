# ConnectLocal Marketplace — Upgrade Notes

This version moves the marketplace from client-trusted checkout to a server-authoritative transaction architecture.

## Main improvements

### Checkout
- Browser sends only product/variety IDs and requested quantities.
- Server reads current product prices and stock.
- Server rejects stale/deleted products.
- Server prevents mixed-seller checkout until split settlement is designed.
- Inventory is decremented atomically.
- Delivery fee is calculated from seller settings and optional buyer GPS coordinates.
- Final subtotal, delivery fee and total are stored on the order.

### Fulfillment
- Seller can configure customer pickup and seller delivery.
- Seller delivery supports base fee, per-km rate, free-delivery threshold and maximum fee.
- Pickup has no delivery fee.
- Delivery fee is locked at checkout.

### Pickup
- One secure server-generated code is associated with each order.
- Buyer and seller see the same code.
- Seller verifies the code through the server.
- Successful verification completes the pickup transaction.

### Order state machine
Arbitrary client status changes are removed. Fulfillment follows validated transitions.

### Refunds
- Buyer requests a refund.
- Admin approves or rejects.
- Provider confirmation is required before an online payment is considered refunded.

### Administration
- Role changes use the Admin SDK.
- Firebase Auth deletion is now real account deletion rather than only deleting the Firestore profile.
- Admin claims are synchronized.
- Permission arrays are supported for future granular staff roles.

### Security
- Client cannot create/update/delete orders directly.
- Product ownership cannot be changed by an owner update.
- Chat message access checks the parent chat participants.
- Payment success is webhook-driven.

## Intentionally not faked

JazzCash and Easypaisa integrations are not populated with invented request hashes, merchant fields or callback rules. Their exact production adapter depends on the merchant API contract. The source has the provider slots and payment architecture ready for those credentials.

## Build verification

All 145 TypeScript/TSX source files were syntax-transpiled successfully during this upgrade, and the order-domain runtime checks passed. A full Next production build still needs to be run after `npm ci` completes in a normal development/CI environment because the sandbox dependency install timed out with an incomplete `node_modules` tree.

# Code scan + fixes (v14)

Verified: strict `tsc` clean, 37 unit tests pass, `next build` succeeds.

## Fixed
1. **Private data exposed to every visitor.** `users/{uid}` was world-readable and the new search/directory pages downloaded the *entire* users collection (emails, phones, balances, Stripe ids, admin flags) into the browser.
   - New `GET /api/public/businesses` and `/api/public/businesses/{id}` return an allow-listed projection only (buyers/admins excluded), CDN-cached for 60 s.
   - Directory, search, new-members carousel, storefront, distributor and product pages use it (`hooks/use-public-business.ts`).
   - `firestore.rules`: `users` read = owner or admin. **Re-publish the rules.**
   - Search no longer reads unbounded products (capped at 500).
2. **Wrong HTTP status codes.** Validation failures ("Product not found", "not enough stock") returned 500, bad JSON returned 500, and raw internal error text reached clients. New `classifyError` / `safeMessage` / `readJsonBody`: 400/401/403/404/409/429/503 as appropriate, generic text for unexpected errors, actionable text for IAM/Firestore problems (incl. `auth/insufficient-permission`).
3. **Payment redirect URLs.** Stripe success/cancel URLs fell back to `http://localhost:3000` in production. New `getAppUrl()` (https forced, localhost ignored in production, uses forwarded host / Vercel URL).
4. **Order id bug in checkout** now uses the document id for Stripe metadata (webhooks match the order).
5. **Orders:** a request carrying an invalid/expired token silently became a *guest* order (and a server misconfiguration looked like "guest"). Guests are now only requests with no Authorization header.
6. **Geo/radius:** latitude/longitude `0` and numeric strings were treated as missing; `Number(null)` produced 0,0 distances. New `isValidCoordinate`; radius lists show up to 50; leftover `[v0]` debug logs removed.
7. **Protocol/headers:** HSTS, nosniff, frame, referrer, Permissions-Policy (geolocation + camera allowed for this origin only), COOP for Google popups, `no-store` on private API responses, `poweredByHeader` off. All route handlers declare the Node runtime; GET routes are `force-dynamic`.
8. Removed stray duplicate `src/package.json` and `src/next.config.js`; added `.env.example`.

## Not changed (needs a decision / live testing)
- No Content-Security-Policy yet (Firebase popups, Stripe and fonts need a tuned policy tested in a browser).
- The directory still reads all members of a role on the server (capped at 500, cached). For large catalogs move to indexed/geohash queries or a search service.
- No rate limiting on public APIs and webhooks (use Vercel Firewall / Upstash).
- `lint` script is `eslint .` but no ESLint config exists; add one before enabling CI lint.
- JazzCash/Easypaisa adapters are intentionally stubs that return 503.

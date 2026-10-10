# Google sign-in and admin custom-claims patch

## What changed
- After profile bootstrap, the client forces a fresh Firebase ID token.
- Email sign-in and Google sign-in inspect `getIdTokenResult(true)` and route users with `claims.role === "admin"` (also accepts legacy `claims.isAdmin === true`) to `/admin`.
- Admin layout refreshes and checks custom claims before allowing access, while retaining the Firestore profile flag as a compatibility fallback.
- Server bootstrap and admin grant endpoints preserve existing custom claims and set both `role: "admin"` and `isAdmin: true`.
- Added `scripts/promote-admin.cjs` to promote an existing Firebase Auth UID safely from a trusted local machine.

## Google sign-in configuration
This code uses Firebase's `GoogleAuthProvider`; there was no Android Client ID or Web Client ID hard-coded in the server verification path. `admin.auth().verifyIdToken()` must receive a **Firebase ID token**, not a raw Google OAuth access token or Google ID token. Do not replace Firebase token verification with Android OAuth client-ID validation.

For Google sign-in, verify Firebase Console → Authentication → Sign-in method → Google is enabled, and add the Vercel production domain under Authentication → Settings → Authorized domains.

## Server environment
The Next.js API routes require `FIREBASE_SERVICE_ACCOUNT_KEY` on the server. Because the frontend/API is deployed on Vercel, configure this as a Vercel server-side Environment Variable (Production/Preview as appropriate), containing the service-account JSON. Never prefix it with `NEXT_PUBLIC_`, commit it, or expose it to the browser. Also ensure `NEXT_PUBLIC_FIREBASE_PROJECT_ID` matches the same Firebase project. Redeploy after changing environment variables.

If Google popup authentication succeeds but profile bootstrap fails, inspect Vercel Function logs for `/api/profile/bootstrap`; the UI now gives a more actionable configuration message.

## Promote existing account
From the project root, with Node.js and dependencies installed:

`GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/service-account.json" node scripts/promote-admin.cjs`

Enter the existing Firebase Auth UID. Store the service-account JSON outside the repository. The script preserves existing claims, sets `role: "admin"` and `isAdmin: true`, and merges `isAdmin: true` into the Firestore user profile. The user must refresh the ID token or sign out/in to receive updated claims.

## Verification limits
The admin promotion script passed `node --check`. A full TypeScript/build/test run could not be completed in this environment because project dependencies are not installed; the attempted `tsc --noEmit` reports missing dependency/type packages. No live Firebase or Vercel configuration was changed by this patch.

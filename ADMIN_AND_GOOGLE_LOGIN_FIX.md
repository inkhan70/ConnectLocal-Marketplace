# Admin dashboard + Google sign-in fix (v11)

## What was wrong
1. **No way into the admin panel.** The header only had a "Dashboard" link (-> business/buyer dashboard). Nothing linked to `/admin`, and on phones the admin sidebar is `hidden lg:flex`, so even inside `/admin` there was no navigation.
2. **Two sources of truth for "admin".** Admin layout accepted claim OR profile flag, but `/api/admin/*`, `firestore.rules`, orders and products only accepted one of them, so admin features silently failed.
3. **Bootstrap errors were hidden.** Any token/claims failure came back as `401 "Authentication required."` and the UI showed only "Please try again." A failing `setCustomUserClaims` failed the entire sign-in.
4. **Missing profile = dead end.** If bootstrap failed, the user stayed signed in with no `users/{uid}` doc -> "User profile not found" / dashboard mismatch.
5. **Legacy profiles forced through role selection** (could overwrite an existing business role).
6. **`firebase-admin` was not in package.json** although every server route imports it.
7. Service-account project could silently differ from the web config project (`distributors-connect-vrglt`), which rejects every login.

## What changed
- `lib/server/firebase-admin.ts`: tolerant key parsing (quotes / base64 / `\n`), project-mismatch detection with a clear error, `HttpError` with codes, shared `isAdminCaller` / `requireAdmin` (claim OR profile, auto-heals drift).
- All admin routes, orders and product delete now use that shared check.
- `admin-bootstrap.ts`: claim write is best-effort; admin profile healed; legacy profiles keep their role.
- `/api/profile/bootstrap` returns `{error, code}`; login screens show the real cause.
- New `hooks/use-is-admin.ts`; Header shows **Admin / Admin Panel**; `/dashboard` redirects admins to `/admin`.
- Admin + dashboard layouts: mobile nav bar, and a missing profile is repaired automatically (with Try again / Sign out screen on failure).
- `firestore.rules`: admin = claim OR profile flag. **Re-publish rules.**
- package.json: added `firebase-admin`.

## Deploy checklist
1. `npm install`, redeploy on Vercel.
2. Publish `firestore.rules` (Firebase Console -> Firestore -> Rules).
3. Vercel env: `FIREBASE_SERVICE_ACCOUNT_KEY` must be a key from project **distributors-connect-vrglt**. The service account needs the *Firebase Authentication Admin* role to set claims (otherwise login still works via the profile flag).
4. Firebase Console -> Authentication -> Settings -> Authorized domains: add your `*.vercel.app` domain.
5. Sign out and sign in again so a fresh token is issued.

## Onboarding after Google/email sign-in (v12)
Sign in -> **Step 1: role** -> **Step 2: business name + category + business type** -> dashboard.
- Buyer and the Doctor shortcut skip step 2 (Doctor is saved as health_doctor).
- `/api/profile/select-role` validates the business type server-side and saves `category`, `subcategoryId`, `subcategoryName`, `businessName` and the matching `dashboardType`, so health / automotive / food / services members get the right dashboard.
- Server errors (e.g. "Please enter your business name") are now shown instead of a generic failure message.

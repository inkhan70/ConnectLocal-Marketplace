# One-time admin promotion

Use this only from a trusted local machine to promote your own existing account.

1. Download a Firebase service-account JSON for the correct Firebase project from Firebase Console → Project settings → Service accounts. Store it OUTSIDE this repository and never commit it.
2. From the project root, run:

   `GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/service-account.json" node scripts/promote-admin.cjs`

3. Paste the UID of the existing Firebase Authentication account when prompted.
4. Sign out and back in (or force-refresh the ID token) to receive the custom claims.

The script preserves existing custom claims and sets both `role: "admin"` and `isAdmin: true`, plus the matching Firestore profile flag. Protect the service-account JSON as a production secret. Do not run against the wrong Firebase project.

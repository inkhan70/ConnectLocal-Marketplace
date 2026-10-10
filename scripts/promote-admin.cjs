#!/usr/bin/env node
/**
 * One-time local admin promotion utility.
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json node scripts/promote-admin.cjs
 * The service-account file must never be committed or uploaded.
 */
const readline = require('node:readline');
const admin = require('firebase-admin');

async function main() {
  if (admin.apps.length === 0) {
    // Application Default Credentials via GOOGLE_APPLICATION_CREDENTIALS.
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const uid = (await new Promise(resolve => rl.question('Existing Firebase Auth UID to promote: ', resolve))).trim();
  rl.close();
  if (!uid || uid.length > 128 || /\\s/.test(uid)) {
    throw new Error('A valid Firebase Auth UID is required.');
  }

  const auth = admin.auth();
  const db = admin.firestore();
  const user = await auth.getUser(uid); // Fails safely if the Auth account does not exist.
  await auth.setCustomUserClaims(uid, {
    ...(user.customClaims || {}),
    role: 'admin',
    isAdmin: true,
  });
  await db.collection('users').doc(uid).set({
    isAdmin: true,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  console.log(`Promoted UID ${uid} to admin.`);
  console.log('The user must sign out/in or force-refresh their Firebase ID token before claims appear in the client.');
}

main().catch(error => {
  console.error('Admin promotion failed:', error.message || error);
  process.exitCode = 1;
});

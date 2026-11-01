#!/usr/bin/env node
/**
 * One-time repair: members who picked a Buyer / Customer / Collector type but were saved as a shopkeeper / service
 * provider (and therefore got the wrong dashboard) become buyers with the buyer dashboard.
 *
 *   DRY RUN (default, writes nothing):  node scripts/fix-buyer-collector-roles.cjs
 *   APPLY:                              node scripts/fix-buyer-collector-roles.cjs --apply
 *
 * Needs FIREBASE_SERVICE_ACCOUNT_KEY (JSON) in the environment. Admins are never touched. Their chosen
 * category / subcategory is kept. Buyers are not listed in the public business directory (intended).
 */
const admin = require('firebase-admin');
const APPLY = process.argv.includes('--apply');
const BUYER = /\b(buyer|customer|collector|shopper)s?\b/;
const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Set FIREBASE_SERVICE_ACCOUNT_KEY');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  const snap = await admin.firestore().collection('users').where('role', 'in', ['company', 'wholesaler', 'distributor', 'shopkeeper', 'services']).get();
  let n = 0;
  for (const doc of snap.docs) {
    const u = doc.data();
    if (u.isAdmin === true) continue;
    if (!(BUYER.test(norm(u.subcategoryName)) || BUYER.test(norm(u.category)))) continue;
    n++;
    console.log(`${APPLY ? 'FIX ' : 'WOULD FIX '} ${doc.id}  ${u.businessName || u.fullName || ''}  role=${u.role} dashboardType=${u.dashboardType} category=${u.category} sub=${u.subcategoryName}  ->  buyer/buyer`);
    if (APPLY) await doc.ref.update({ role: 'buyer', dashboardType: 'buyer', updatedAt: new Date().toISOString() });
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'}: ${n} member(s) ${APPLY ? 'updated' : 'would be updated'}.`);
  if (!APPLY) console.log('Re-run with --apply to write the changes.');
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });

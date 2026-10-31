#!/usr/bin/env node
/**
 * One-time migration: re-point existing members that were saved with an OLD built-in business-type id
 * (health_clinic, food_restaurant, ...) or an id that is no longer in the live category list, so they show up on the
 * guest category pages again.
 *
 *   DRY RUN (default, writes nothing):  node scripts/migrate-member-categories.cjs
 *   APPLY:                              node scripts/migrate-member-categories.cjs --apply
 *
 * Needs FIREBASE_SERVICE_ACCOUNT_KEY (JSON) and FIREBASE_DATABASE_URL in the environment (same values as Vercel).
 * Members it cannot map are listed and left untouched. Nothing is deleted.
 */
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const ALIASES = require('./legacy-category-aliases.json');
const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (v) => norm(v).replace(/ /g, '-') || 'category';

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Set FIREBASE_SERVICE_ACCOUNT_KEY');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), databaseURL: process.env.FIREBASE_DATABASE_URL });

  const rtdb = (await admin.database().ref('categories').get()).val() || {};
  const live = Object.entries(rtdb)
    .map(([id, c]) => ({ id, name: c.name, slug: c.slug || slug(c.name), parentId: c.parentId || null, active: c.enabled !== false && c.isActive !== false }))
    .filter((c) => c.active);
  const parents = live.filter((c) => !c.parentId);
  const children = live.filter((c) => c.parentId);
  if (!children.length) throw new Error('Live category list is empty - aborting.');

  const db = admin.firestore();
  const snap = await db.collection('users').where('role', 'in', ['company', 'wholesaler', 'distributor', 'shopkeeper', 'services']).get();
  let ok = 0, fixed = 0, unmapped = 0;
  for (const doc of snap.docs) {
    const u = doc.data();
    if (u.isAdmin === true) continue;
    const current = children.find((c) => c.id === u.subcategoryId);
    if (current) {
      const parent = parents.find((p) => p.id === current.parentId);
      if (parent && u.categoryId === parent.id && u.category === parent.slug) { ok++; continue; }
      if (parent) { fixed++; log(doc.id, u, parent, current, 'add categoryId'); if (APPLY) await doc.ref.update({ category: parent.slug, categoryId: parent.id }); continue; }
    }
    const alias = ALIASES[u.subcategoryId];
    let match = null;
    if (alias) {
      const [catSlug, childName] = alias;
      const parent = parents.find((p) => norm(p.slug) === norm(catSlug));
      const pool = parent ? children.filter((c) => c.parentId === parent.id) : children;
      const child = pool.find((c) => norm(c.name) === norm(childName)) || children.find((c) => norm(c.name) === norm(childName));
      if (child) match = { parent: parents.find((p) => p.id === child.parentId), child };
    }
    if (!match || !match.parent) { unmapped++; console.log(`UNMAPPED  ${doc.id}  ${u.businessName || ''}  category=${u.category} subcategoryId=${u.subcategoryId}`); continue; }
    fixed++;
    log(doc.id, u, match.parent, match.child, 'remap');
    // Keep health_doctor as-is: the doctor dashboard checks that exact id. Only the category placement is fixed.
    const patch = u.subcategoryId === 'health_doctor'
      ? { category: match.parent.slug, categoryId: match.parent.id }
      : { category: match.parent.slug, categoryId: match.parent.id, subcategoryId: match.child.id, subcategoryName: match.child.name };
    if (APPLY) await doc.ref.update(patch);
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'}: already correct=${ok}, ${APPLY ? 'updated' : 'would update'}=${fixed}, unmapped=${unmapped}`);
  if (!APPLY) console.log('Re-run with --apply to write the changes.');
}
function log(id, u, parent, child, why) {
  console.log(`${why.padEnd(14)} ${id}  ${u.businessName || ''}  ${u.category}/${u.subcategoryId}  ->  ${parent.slug}/${child.id} (${child.name})`);
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });

import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { createDefaultUserProfile } from '@/lib/user-utils';

/**
 * Server-authoritative first-admin bootstrap.
 *
 * `config/bootstrap` is the single, permanent "system initialised" marker. It lives in the `config`
 * collection, which Firestore rules deny to every client. The decision is made inside ONE Firestore
 * transaction that reads the marker (and, if it is absent, whether any admin already exists) and writes
 * the marker. Two concurrent first-time callers therefore contend on the same document: Firestore aborts
 * and retries one of them, which then reads the committed marker and is NOT promoted.
 *
 * Rules enforced here:
 *  - Only a verified identity may become the first admin (email/password users must have a verified email).
 *  - If any admin already exists, nobody is ever promoted automatically; the system is marked initialised.
 *  - Existing users, profiles and data are never deleted or reset. A missing profile is created; an
 *    existing profile is only patched with the admin fields when this user wins the bootstrap.
 *  - Existing Firebase Auth custom claims are preserved when `isAdmin` is added.
 */

export const BOOTSTRAP_DOC = { collection: 'config', id: 'bootstrap' } as const;

export interface BootstrapCaller {
  uid: string;
  email?: string | null;
  emailVerified: boolean;
  displayName?: string | null;
}

export interface BootstrapProfileHints {
  role?: string;
  businessName?: string;
  fullName?: string;
  category?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  address?: string;
  city?: string;
  state?: string;
  countryCode?: string;
}

export interface BootstrapResult {
  isAdmin: boolean;
  /** True only on the single call that made this user the first admin. */
  becameAdmin: boolean;
  initialized: boolean;
  profileCreated: boolean;
  needsRoleSelection: boolean;
  /** Set when the caller was not eligible yet (unverified email); nothing was marked initialised. */
  deferredReason?: 'email_not_verified';
}

const ALLOWED_SIGNUP_ROLES = ['buyer', 'company', 'wholesaler', 'distributor', 'shopkeeper', 'services'];

function cleanString(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : undefined;
}

/** Only harmless, user-supplied profile text is accepted; privileged fields can never come from the client. */
export function sanitizeHints(raw: any): BootstrapProfileHints {
  const hints: BootstrapProfileHints = {};
  if (!raw || typeof raw !== 'object') return hints;
  const role = cleanString(raw.role, 40);
  if (role && ALLOWED_SIGNUP_ROLES.includes(role)) hints.role = role;
  for (const key of ['businessName', 'fullName', 'category', 'subcategoryId', 'subcategoryName', 'address', 'city', 'state'] as const) {
    const v = cleanString(raw[key]);
    if (v) hints[key] = v;
  }
  const cc = cleanString(raw.countryCode, 2);
  if (cc && /^[A-Za-z]{2}$/.test(cc)) hints.countryCode = cc.toUpperCase();
  return hints;
}

export async function bootstrapProfile(
  db: Firestore,
  auth: Auth,
  caller: BootstrapCaller,
  hints: BootstrapProfileHints = {},
): Promise<BootstrapResult> {
  const bootRef = db.collection(BOOTSTRAP_DOC.collection).doc(BOOTSTRAP_DOC.id);
  const userRef = db.collection('users').doc(caller.uid);

  const outcome = await db.runTransaction(async (tx) => {
    // ---- all reads first ----
    const [bootSnap, userSnap] = await Promise.all([tx.get(bootRef), tx.get(userRef)]);
    const initialized = bootSnap.exists && bootSnap.data()?.initialized === true;

    let adminExists = false;
    if (!initialized) {
      const admins = await tx.get(db.collection('users').where('isAdmin', '==', true).limit(1));
      adminExists = !admins.empty;
    }

    const existing: any = userSnap.exists ? userSnap.data() : null;
    const alreadyAdmin = existing?.isAdmin === true;

    let promote = false;
    let deferredReason: BootstrapResult['deferredReason'];
    if (!initialized && !adminExists) {
      if (!caller.emailVerified) deferredReason = 'email_not_verified';
      else promote = true;
    }

    // ---- writes ----
    let profileCreated = false;
    if (!userSnap.exists) {
      const base: any = createDefaultUserProfile(caller.uid, caller.email || '', {
        role: (hints.role as any) || 'buyer',
        businessName: hints.businessName,
        fullName: hints.fullName || caller.displayName || '',
        category: hints.category,
        subcategoryId: hints.subcategoryId,
        subcategoryName: hints.subcategoryName,
        address: hints.address || '',
        city: hints.city || '',
        state: hints.state || '',
        countryCode: hints.countryCode,
      });
      base.isAdmin = false;
      base.needsRoleSelection = true;
      Object.keys(base).forEach((k) => base[k] === undefined && delete base[k]);
      tx.set(userRef, base);
      profileCreated = true;
    }

    if (promote) {
      tx.set(userRef, {
        isAdmin: true,
        needsRoleSelection: false,
        roleSelectionCompleted: true,
        adminBootstrappedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      tx.set(bootRef, { initialized: true, reason: 'first_admin', firstAdminUid: caller.uid, at: FieldValue.serverTimestamp() });
    } else if (!initialized && adminExists) {
      // An admin already exists (pre-existing deployment): record it permanently, promote nobody.
      tx.set(bootRef, { initialized: true, reason: 'admin_exists', at: FieldValue.serverTimestamp() });
    }

    const isAdmin = promote || alreadyAdmin;
    const needsRoleSelection = isAdmin ? false : (profileCreated ? true : !(existing?.roleSelectionCompleted === true) || existing?.needsRoleSelection === true || !existing?.role);
    return { isAdmin, promote, profileCreated, needsRoleSelection, deferredReason, initialized: initialized || promote || adminExists };
  });

  // Claims are set after the transaction commits (they are not part of Firestore). The call is idempotent, so a
  // retry of /api/profile/bootstrap repairs a failed attempt. Existing claims are preserved.
  if (outcome.isAdmin) {
    const record = await auth.getUser(caller.uid);
    if (record.customClaims?.isAdmin !== true) {
      await auth.setCustomUserClaims(caller.uid, { ...(record.customClaims || {}), isAdmin: true });
    }
  }

  return {
    isAdmin: outcome.isAdmin,
    becameAdmin: outcome.promote,
    initialized: outcome.initialized,
    profileCreated: outcome.profileCreated,
    needsRoleSelection: outcome.needsRoleSelection,
    ...(outcome.deferredReason ? { deferredReason: outcome.deferredReason } : {}),
  };
}

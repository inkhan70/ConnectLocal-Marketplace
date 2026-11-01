import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { createDefaultUserProfile } from '@/lib/user-utils';
import { roleForSelection } from '@/lib/category-live';
import { findSubcategory } from '@/lib/subcategories';
import { normalizePhone } from '@/lib/contact';

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
  /** The verified ID token already carries the admin custom claim (role === 'admin' or isAdmin === true). */
  claimIsAdmin?: boolean;
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
  latitude?: number;
  longitude?: number;
  /** True when the person already chose their role (and business type) on the sign-up form. */
  roleSelected?: boolean;
  /** Business WhatsApp / call number typed at sign-up (validated and stored as +E.164). */
  contactWhatsapp?: string;
}

export interface BootstrapResult {
  isAdmin: boolean;
  /** True only on the single call that made this user the first admin. */
  becameAdmin: boolean;
  initialized: boolean;
  profileCreated: boolean;
  needsRoleSelection: boolean;
  /** False when the Firestore profile is correct but the Auth custom claim could not be written (non-fatal). */
  claimsSynced?: boolean;
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
  const lat = Number(raw.latitude);
  const lon = Number(raw.longitude);
  if (raw.latitude !== null && raw.latitude !== '' && raw.longitude !== null && raw.longitude !== '' &&
      Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    hints.latitude = lat;
    hints.longitude = lon;
  }
  if (raw.roleSelected === true) hints.roleSelected = true;
  if (raw.contactWhatsapp) {
    const phone = normalizePhone(raw.contactWhatsapp, typeof raw.countryCode === 'string' ? raw.countryCode : undefined);
    if (phone.ok) hints.contactWhatsapp = phone.e164;
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
  // Validates the chosen business type. The API route passes a resolver backed by the LIVE admin category list;
  // the built-in catalogue is only the fallback (used by tests and when the live list cannot be read).
  resolveType: (subcategoryId: string, role: string) => { categoryKey: string; categoryId?: string; option: { id: string; name: string } } | null = (id) => findSubcategory(id),
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
    // Admin status lives in the Firestore profile AND the Auth custom claim; either one is enough.
    const alreadyAdmin = existing?.isAdmin === true || caller.claimIsAdmin === true;

    let promote = false;
    let deferredReason: BootstrapResult['deferredReason'];
    if (!initialized && !adminExists) {
      if (!caller.emailVerified) deferredReason = 'email_not_verified';
      else promote = true;
    }

    // ---- writes ----
    let profileCreated = false;
    let onboardingComplete = false;
    if (!userSnap.exists) {
      // Business type is validated against the built-in catalogue; category/name/dashboard layout come from it,
      // never from free text sent by the browser.
      let role = (hints.role as any) || 'buyer';
      let chosenType = hints.subcategoryId ? resolveType(hints.subcategoryId, role) : null;
      // A Buyer / Customer / Collector business type always makes a buyer (never a shopkeeper / service provider).
      if (role !== 'buyer' && chosenType && roleForSelection(hints.category, chosenType.option.name) === 'buyer') {
        role = 'buyer';
        chosenType = resolveType(hints.subcategoryId as string, role);
      }
      // Onboarding is complete when the sign-up form already collected the role (and, for businesses, a valid type).
      onboardingComplete = hints.roleSelected === true && (role === 'buyer' || chosenType !== null);
      const base: any = createDefaultUserProfile(caller.uid, caller.email || '', {
        role,
        businessName: hints.businessName,
        fullName: hints.fullName || caller.displayName || '',
        category: chosenType ? chosenType.categoryKey : hints.category,
        subcategoryId: chosenType ? chosenType.option.id : undefined,
        subcategoryName: chosenType ? chosenType.option.name : undefined,
        latitude: hints.latitude,
        longitude: hints.longitude,
        address: hints.address || '',
        city: hints.city || '',
        state: hints.state || '',
        countryCode: hints.countryCode,
      });
      // A caller whose verified token already has the admin claim gets an admin profile (the claim is server-set).
      base.isAdmin = caller.claimIsAdmin === true;
      if (chosenType && (chosenType as any).categoryId) base.categoryId = (chosenType as any).categoryId;
      if (chosenType && (chosenType as any).option.dashboardType) base.dashboardType = (chosenType as any).option.dashboardType;
      // Buyers always open the buyer dashboard, whatever (optional) category they picked.
      if (role === 'buyer') base.dashboardType = 'buyer';
      // Defence in depth: re-validate here too, so only a clean +E.164 number is ever stored.
      const whatsapp = hints.contactWhatsapp ? normalizePhone(hints.contactWhatsapp) : null;
      if (whatsapp?.ok) base.contactWhatsapp = whatsapp.e164;
      base.needsRoleSelection = caller.claimIsAdmin !== true && !onboardingComplete;
      base.roleSelectionCompleted = caller.claimIsAdmin === true || onboardingComplete;
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
    } else if (alreadyAdmin && userSnap.exists && (existing?.isAdmin !== true || existing?.needsRoleSelection === true)) {
      // Heal an admin whose profile lags behind the claim (or was left flagged for role selection): admins never
      // go through role selection and Firestore rules / server routes read `isAdmin` from the profile.
      tx.set(userRef, { isAdmin: true, needsRoleSelection: false, roleSelectionCompleted: true, updatedAt: new Date().toISOString() }, { merge: true });
    }

    if (!promote && !initialized && adminExists) {
      // An admin already exists (pre-existing deployment): record it permanently, promote nobody.
      tx.set(bootRef, { initialized: true, reason: 'admin_exists', at: FieldValue.serverTimestamp() });
    }

    const isAdmin = promote || alreadyAdmin;
    // Only profiles that were explicitly created for onboarding (or have no role at all) must pick a role.
    // Legacy profiles that already have a role keep it; forcing them through role selection would overwrite it.
    const needsRoleSelection = isAdmin ? false : (profileCreated ? !onboardingComplete : existing?.needsRoleSelection === true || !existing?.role);
    return { isAdmin, promote, profileCreated, needsRoleSelection, deferredReason, initialized: initialized || promote || adminExists };
  });

  // Claims are set after the transaction commits (they are not part of Firestore). The call is idempotent, so a
  // retry of /api/profile/bootstrap repairs a failed attempt. Existing claims are preserved.
  // Best effort: the Firestore profile flag already grants access everywhere (UI, rules, server routes), so a failure
  // here (e.g. the service account lacks the Firebase Authentication Admin role) must NOT fail the whole sign-in.
  let claimsSynced = true;
  if (outcome.isAdmin) {
    try {
      const record = await auth.getUser(caller.uid);
      if (record.customClaims?.isAdmin !== true || record.customClaims?.role !== 'admin') {
        await auth.setCustomUserClaims(caller.uid, { ...(record.customClaims || {}), isAdmin: true, role: 'admin' });
      }
    } catch (error) {
      claimsSynced = false;
      console.error('Could not sync admin custom claims (profile flag still applies):', error);
    }
  }

  return {
    isAdmin: outcome.isAdmin,
    becameAdmin: outcome.promote,
    initialized: outcome.initialized,
    profileCreated: outcome.profileCreated,
    needsRoleSelection: outcome.needsRoleSelection,
    claimsSynced,
    ...(outcome.deferredReason ? { deferredReason: outcome.deferredReason } : {}),
  };
}

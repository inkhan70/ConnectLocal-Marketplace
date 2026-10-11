import * as firebaseAuth from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { bootstrapUserProfile } from "@/lib/bootstrap-client";

export interface GoogleAuthOutcome {
  isAdmin: boolean;
  needsRoleSelection: boolean;
}

/**
 * Makes sure a Firestore profile exists for a Google user and reports
 * where they should go next. New users are created as "buyer" with
 * needsRoleSelection = true so the select-role step is mandatory.
 */
export async function ensureGoogleUserProfile(
  firestore: Firestore,
  user: { uid: string; email?: string | null; displayName?: string | null; getIdToken: (forceRefresh?: boolean) => Promise<string> },
  auth?: any
): Promise<GoogleAuthOutcome> {
  // The server verifies the ID token, creates a missing profile and decides admin status. For existing users
  // nothing is overwritten; needsRoleSelection is computed from their stored onboarding state.
  let outcome: Awaited<ReturnType<typeof bootstrapUserProfile>>;
  try {
    outcome = await bootstrapUserProfile(user, { role: "buyer", fullName: user.displayName || "Google user" });
  } catch (error) {
    // A server hiccup must not lock out members who already have a profile: carry on with what is stored.
    let existing: Record<string, any> | null = null;
    try {
      const snap = await getDoc(doc(firestore, "users", user.uid));
      existing = snap.exists() ? (snap.data() as Record<string, any>) : null;
    } catch { /* profile unreadable -> treated as missing */ }

    if (existing && existing.role) {
      console.warn("Profile bootstrap failed; continuing with the existing profile.", error);
      return { isAdmin: existing.isAdmin === true, needsRoleSelection: existing.needsRoleSelection === true };
    }

    // No usable profile: do not leave the user half signed-in (which silently lands them on a broken dashboard).
    try { if (auth) await (firebaseAuth as any).signOut(auth); } catch { /* ignore */ }
    throw error;
  }
  await user.getIdToken(true);
  const tokenResult = await (user as any).getIdTokenResult(true);
  const claimIsAdmin = tokenResult.claims.role === "admin" || tokenResult.claims.isAdmin === true;
  return { isAdmin: claimIsAdmin || outcome.isAdmin, needsRoleSelection: outcome.needsRoleSelection };
}

/** Where to send the user after a successful Google sign-in. */
export function getPostGoogleDestination(outcome: GoogleAuthOutcome, redirectPath?: string | null): string {
  const safeRedirect = redirectPath && redirectPath.startsWith("/") ? redirectPath : null;
  if (outcome.isAdmin) return "/admin";
  if (outcome.needsRoleSelection) {
    return safeRedirect ? `/select-role?redirect=${encodeURIComponent(safeRedirect)}` : "/select-role";
  }
  return safeRedirect || "/dashboard";
}

/**
 * Starts Google sign-in. Uses a popup (works on desktop and mobile Chrome and
 * avoids the third-party-storage problems of redirect flows). Falls back to a
 * redirect only if the browser blocks the popup.
 * Returns the outcome, or "redirecting" if the page is navigating away.
 */
export async function startGoogleSignIn(
  auth: any,
  firestore: Firestore
): Promise<GoogleAuthOutcome | "redirecting"> {
  const provider = new (firebaseAuth as any).GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await (firebaseAuth as any).signInWithPopup(auth, provider);
    return await ensureGoogleUserProfile(firestore, result.user, auth);
  } catch (error: any) {
    if (
      error?.code === "auth/popup-blocked" ||
      error?.code === "auth/operation-not-supported-in-this-environment"
    ) {
      await (firebaseAuth as any).signInWithRedirect(auth, provider);
      return "redirecting";
    }
    throw error;
  }
}

/** Completes a redirect-based sign-in (only used after the popup fallback). */
export async function completeGoogleRedirect(
  auth: any,
  firestore: Firestore
): Promise<GoogleAuthOutcome | null> {
  const result = await (firebaseAuth as any).getRedirectResult(auth);
  if (!result?.user) return null;
  return await ensureGoogleUserProfile(firestore, result.user, auth);
}

/** Turns Firebase error codes into messages the user (and you) can act on. */
export function describeGoogleAuthError(error: any): string {
  const code: string = error?.code || "";
  const message = typeof error?.message === "string" ? error.message : "";
  const bootstrapCode: string = error?.bootstrapCode || "";
  // Server-side configuration problems come with an actionable message (and a code) - show it as is.
  if (error?.bootstrapStatus && /^(project_mismatch|service_account|firestore_|auth\/|invalid_|missing_token)/.test(bootstrapCode)) {
    if (error.bootstrapStatus === 401) {
      return `Signed in with Google, but the server rejected your login token (${bootstrapCode}). The Firebase service-account key on Vercel is probably from a different Firebase project than this web app. Open /api/health/firebase to check.`;
    }
    return `${message} (${bootstrapCode}). You can verify the server setup at /api/health/firebase.`;
  }
  if (error?.bootstrapStatus === 401) {
    return "Signed in with Google, but the server rejected your login token. Open /api/health/firebase to check the server setup.";
  }
  if (error?.bootstrapStatus >= 500) {
    return `Signed in with Google, but the server could not create your profile${bootstrapCode ? ` (${bootstrapCode})` : ""}. Open /api/health/firebase to see what is wrong.`;
  }
  if (message.includes("Could not initialise") || message.includes("Unable to initialise") || message.includes("FIREBASE_SERVICE_ACCOUNT_KEY")) {
    return "Google authentication succeeded, but the server could not initialize your profile. Check the Firebase Admin service-account configuration and server logs, then try again.";
  }
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The sign-in window was closed before finishing.";
    case "auth/unauthorized-domain":
      return `This website's domain (${typeof window !== "undefined" ? window.location.hostname : ""}) is not authorized for Google sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.`;
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method. Sign in with email and password instead.";
    case "auth/internal-error":
    case "auth/invalid-api-key":
      return "Firebase configuration problem (" + code + "). Check your Firebase web config.";
    case "permission-denied":
    case "firestore/permission-denied":
      return "Signed in, but your profile could not be saved (Firestore permission denied). Check your Firestore rules.";
    default:
      return code ? `Please try again. (${code})` : "Please try again.";
  }
}

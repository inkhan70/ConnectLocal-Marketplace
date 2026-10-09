import * as firebaseAuth from "firebase/auth";
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
  _firestore: Firestore,
  user: { uid: string; email?: string | null; displayName?: string | null; getIdToken: (forceRefresh?: boolean) => Promise<string> }
): Promise<GoogleAuthOutcome> {
  // The server verifies the ID token, creates a missing profile and decides admin status. For existing users
  // nothing is overwritten; needsRoleSelection is computed from their stored onboarding state.
  const outcome = await bootstrapUserProfile(user, { role: "buyer", fullName: user.displayName || "Google user" });
  return { isAdmin: outcome.isAdmin, needsRoleSelection: outcome.needsRoleSelection };
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
    return await ensureGoogleUserProfile(firestore, result.user);
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
  return await ensureGoogleUserProfile(firestore, result.user);
}

/** Turns Firebase error codes into messages the user (and you) can act on. */
export function describeGoogleAuthError(error: any): string {
  const code: string = error?.code || "";
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

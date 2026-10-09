/**
 * Client helper for the secure /api/profile/bootstrap endpoint.
 *
 * The browser never decides who is an admin and never writes `isAdmin`. It only presents its Firebase ID token;
 * the server verifies it, creates a missing profile and (for the very first verified user of an uninitialised
 * system) promotes the account using the Firebase Admin SDK.
 */
export interface BootstrapProfileInput {
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

export interface BootstrapOutcome {
  isAdmin: boolean;
  becameAdmin: boolean;
  initialized: boolean;
  profileCreated: boolean;
  needsRoleSelection: boolean;
  deferredReason?: 'email_not_verified';
}

export async function bootstrapUserProfile(
  user: { getIdToken: (forceRefresh?: boolean) => Promise<string> },
  profile?: BootstrapProfileInput,
): Promise<BootstrapOutcome> {
  const idToken = await user.getIdToken();
  const response = await fetch('/api/profile/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ profile: profile || {} }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Could not initialise your profile.');

  // The isAdmin custom claim is only present on a freshly issued ID token.
  if (data.becameAdmin) {
    try { await user.getIdToken(true); } catch { /* the claim will arrive on the next natural refresh */ }
  }
  return data as BootstrapOutcome;
}

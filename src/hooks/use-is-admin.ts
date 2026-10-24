"use client";

import { useEffect, useState } from "react";
import { getIdTokenResult } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useAuth as useFirebaseAuth } from "@/firebase";

/**
 * Single client-side definition of "is this user an administrator?".
 * Admin if the Firebase custom claim says so OR the Firestore profile flag does (the server keeps the two in sync,
 * but either can lag right after a promotion). `checking` is true until the claim has been read.
 */
export function useIsAdmin(forceRefresh = false) {
  const { user, userProfile } = useAuth();
  const firebaseAuth = useFirebaseAuth();
  const [claimIsAdmin, setClaimIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const current = firebaseAuth?.currentUser;
      if (!user || !current) {
        if (!cancelled) { setClaimIsAdmin(false); setChecking(false); }
        return;
      }
      setChecking(true);
      try {
        const token = await getIdTokenResult(current, forceRefresh);
        if (!cancelled) setClaimIsAdmin(token.claims.role === "admin" || token.claims.isAdmin === true);
      } catch (error) {
        console.error("Unable to read admin custom claims:", error);
        if (!cancelled) setClaimIsAdmin(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void check();
    return () => { cancelled = true; };
  }, [firebaseAuth, user?.uid, forceRefresh]);

  return { isAdmin: claimIsAdmin || userProfile?.isAdmin === true, checking };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  completeGoogleRedirect,
  describeGoogleAuthError,
  getPostGoogleDestination,
  startGoogleSignIn,
  type GoogleAuthOutcome,
} from "@/lib/google-auth";

/**
 * Shared Google sign-in / sign-up logic.
 * Flow: Google login -> /select-role (new users) -> /dashboard.
 */
export function useGoogleAuth(mode: "signin" | "signup", redirectPath?: string | null) {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const redirectHandled = useRef(false);

  const label = mode === "signup" ? "Google sign-up failed" : "Google sign-in failed";

  const goNext = useCallback(
    (outcome: GoogleAuthOutcome) => {
      router.push(getPostGoogleDestination(outcome, redirectPath));
    },
    [router, redirectPath]
  );

  // Finish a redirect-based sign-in (only happens if the popup was blocked).
  useEffect(() => {
    if (redirectHandled.current) return;
    redirectHandled.current = true;

    completeGoogleRedirect(auth, firestore)
      .then((outcome) => {
        if (outcome) goNext(outcome);
      })
      .catch((error: any) => {
        console.error("Google redirect sign-in error:", error);
        toast({ title: label, description: describeGoogleAuthError(error), variant: "destructive" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setIsGoogleLoading(true);
    try {
      const outcome = await startGoogleSignIn(auth, firestore);
      if (outcome === "redirecting") return; // page is navigating to Google
      goNext(outcome);
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      toast({ title: label, description: describeGoogleAuthError(error), variant: "destructive" });
    } finally {
      setIsGoogleLoading(false);
    }
  }, [auth, firestore, goNext, label, toast]);

  return { signInWithGoogle, isGoogleLoading };
}

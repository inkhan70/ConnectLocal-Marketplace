"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestore, useAuth as useFirebaseAuth } from "@/firebase";
import { bootstrapUserProfile } from "@/lib/bootstrap-client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// "doctor" is not a stored role: it is saved as a service provider with the
// health_doctor subcategory so the correct dashboard is shown.
const BUSINESS_ROLES = [
  { id: "buyer", label: "Buyer / Customer", description: "Shop and purchase products" },
  { id: "company", label: "Producer / Company", description: "Produce and sell products" },
  { id: "wholesaler", label: "Wholesaler", description: "Wholesale distribution" },
  { id: "distributor", label: "Distributor", description: "Distribute products" },
  { id: "shopkeeper", label: "Shopkeeper", description: "Retail shop owner" },
  { id: "doctor", label: "Doctor / Professional", description: "Medical professional" },
  { id: "services", label: "Service Provider", description: "Provide professional services" },
];

function SelectRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect");
  const { user, userProfile, loading } = useAuth();
  const firestore = useFirestore();
  const firebaseAuth = useFirebaseAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const finished = useRef(false);
  const healing = useRef(false);

  useEffect(() => {
    if (loading || finished.current) return;

    // Not signed in -> sign in first, then come back here.
    if (!user) {
      router.replace("/signin?redirect=%2Fselect-role");
      return;
    }

    // Signed in but no profile document yet -> create one so the page can work.
    if (!userProfile) {
      if (healing.current) return;
      healing.current = true;
      (async () => {
        try {
          // Server creates the missing profile from the verified token (never an admin from the browser).
          await bootstrapUserProfile(user as any, { role: "buyer", fullName: user.displayName || "" });
        } catch (error) {
          console.error("Could not create user profile:", error);
        }
      })();
      return;
    }

    // Role already chosen earlier -> straight to the dashboard.
    if (!userProfile.needsRoleSelection) {
      router.replace("/dashboard");
    }
  }, [loading, user, userProfile, router, firestore]);

  const handleRoleSelection = async () => {
    if (!selectedRole || !userProfile) {
      toast({
        title: "Selection Required",
        description: "Please select a business role to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Your login session expired. Please sign in again.");

      const response = await fetch("/api/profile/select-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ role: selectedRole }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Failed to save your role.");
      finished.current = true;

      toast({
        title: "Role Selected",
        description: `You've been set up as a ${BUSINESS_ROLES.find(r => r.id === selectedRole)?.label}.`,
      });

      // Role selection is an onboarding boundary: always enter the correct dashboard.
      // Any original deep link can be revisited from the dashboard without bypassing onboarding.
      router.replace("/dashboard");
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: "Failed to save your role. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">Select Your Role</CardTitle>
          <CardDescription className="text-base mt-2">
            Welcome, {userProfile?.fullName || userProfile?.email}! <br />
            Choose how you'd like to use ConnectLocal to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Role Selection Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {BUSINESS_ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  selectedRole === role.id
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/50"
                }`}
              >
                <div className="font-semibold text-sm">{role.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{role.description}</div>
              </button>
            ))}
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleRoleSelection}
            disabled={!selectedRole || isLoading}
            className="w-full h-12 text-base"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Dashboard
          </Button>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> This selection determines your initial workspace and dashboard. Additional business/profile details can be completed from your dashboard.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SelectRolePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <SelectRoleContent />
    </Suspense>
  );
}

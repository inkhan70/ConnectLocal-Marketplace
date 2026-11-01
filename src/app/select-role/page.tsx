"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAuth as useFirebaseAuth } from "@/firebase";
import { bootstrapUserProfile } from "@/lib/bootstrap-client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLiveCategories } from "@/hooks/use-live-categories";
import { categoryKeyFor, childCategories, roleForSelection, topLevelCategories } from "@/lib/category-live";
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
  const firebaseAuth = useFirebaseAuth();

  const { toast } = useToast();
  const { t } = useLanguage();
  // New registrations start directly on the business setup screen. The selected
  // live business type determines the directory placement; shopkeeper is the
  // default role for retail listings.
  const [selectedRole, setSelectedRole] = useState<string>("buyer");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(2);
  const [categoryKey, setCategoryKey] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");

  // Onboarding reads the SAME live admin category list that guests browse (GET /api/categories), so a member can
  // only register under a category/business type that the guest pages actually link to.
  const { list: liveCategories, isLoading: categoriesLoading, error: categoriesError } = useLiveCategories();
  const categoryChoices = useMemo(() => topLevelCategories(liveCategories).map((category) => ({ id: category.id, key: categoryKeyFor(category), name: category.name })), [liveCategories]);
  const availableSubcategories = useMemo(() => childCategories(liveCategories, categoryKey).map((child) => ({ id: child.id, name: child.name })), [liveCategories, categoryKey]);

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
  }, [loading, user, userProfile, router]);

  const needsBusinessType = selectedRole !== "" && selectedRole !== "buyer" && selectedRole !== "doctor";

  const handleContinue = () => {
    if (!selectedRole) {
      toast({ title: "Selection Required", description: "Please select a role to continue.", variant: "destructive" });
      return;
    }
    if (needsBusinessType) setStep(2);
    else void handleRoleSelection();
  };

  const handleRoleSelection = async () => {
    if (needsBusinessType && (!subcategoryId || !businessName.trim())) {
      toast({
        title: "Business details required",
        description: !subcategoryId ? "Please choose your business type." : "Please enter your business name.",
        variant: "destructive",
      });
      return;
    }
    const isBuyer = selectedRole === "buyer";
    if (!selectedRole || (!isBuyer && !categoryKey) || !user) {
      toast({
        title: "Selection Required",
        description: !user ? "Your login session is still loading. Please try again." : "Please select a business category to continue.",
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
        body: JSON.stringify({ role: selectedRole, category: categoryChoices.find((c) => c.id === categoryKey)?.key, ...(subcategoryId ? { subcategoryId, subcategoryName: availableSubcategories.find((item) => item.id === subcategoryId)?.name } : {}), ...(businessName.trim() ? { businessName: businessName.trim() } : {}) }),
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
        description: error?.message || "Failed to save your role. Please try again.",
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
          <CardTitle className="text-3xl font-headline">Set Up Your Business</CardTitle>
          <CardDescription className="text-base mt-2">
            Welcome, {userProfile?.fullName || userProfile?.email}! <br />
            Tell us about your business to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 ? (
            <>
              {/* Step 1: role */}
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
              <Button onClick={handleContinue} disabled={!selectedRole || isLoading} className="w-full h-12 text-base">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {needsBusinessType ? "Next: Business Type" : "Continue to Dashboard"}
              </Button>
            </>
          ) : (
            <>
              {/* Step 2: business type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Business name</label>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Al-Noor Pharmacy" maxLength={120} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Business category</label>
                {categoriesLoading && <p className="text-xs text-muted-foreground">Loading categories…</p>}
                {categoriesError && !categoriesLoading && categoryChoices.length === 0 && <p className="text-xs text-destructive">Could not load categories. Please refresh and try again.</p>}
                <Select value={categoryKey} onValueChange={(v) => { setCategoryKey(v); setSelectedRole(roleForSelection(categoryChoices.find((category) => category.id === v)?.name || v)); setSubcategoryId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                  <SelectContent>
                    {categoryChoices.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {categoryKey && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Business type</label>
                  <div className="grid md:grid-cols-2 gap-3">
                    {availableSubcategories.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => { setSubcategoryId(sub.id); setSelectedRole(roleForSelection(categoryChoices.find((category) => category.id === categoryKey)?.name, sub.name)); }}
                        className={`p-3 border-2 rounded-lg text-left text-sm transition-all ${
                          subcategoryId === sub.id ? "border-primary bg-primary/5 font-semibold" : "border-muted hover:border-primary/50"
                        }`}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={handleRoleSelection} disabled={(selectedRole !== "buyer" && !categoryKey) || (needsBusinessType && (!subcategoryId || !businessName.trim())) || isLoading} className="w-full h-12 text-base">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to Dashboard
              </Button>
            </>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> Your role and business type decide which dashboard you get. Address and other details can be completed later from your dashboard settings.
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

"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestore } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
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

const BUSINESS_ROLES = [
  { id: "buyer", label: "Buyer / Customer", description: "Shop and purchase products" },
  { id: "company", label: "Producer / Company", description: "Produce and sell products" },
  { id: "wholesaler", label: "Wholesaler", description: "Wholesale distribution" },
  { id: "distributor", label: "Distributor", description: "Distribute products" },
  { id: "shopkeeper", label: "Shopkeeper", description: "Retail shop owner" },
  { id: "doctor", label: "Doctor / Professional", description: "Medical professional" },
  { id: "services", label: "Service Provider", description: "Provide professional services" },
];

export default function SelectRolePage() {
  const router = useRouter();
  const { userProfile, loading } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if not authenticated or already has a role
  if (!loading && (!userProfile || (userProfile.role && userProfile.role !== "buyer"))) {
    router.push("/dashboard");
    return null;
  }

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
      const userRef = doc(firestore, "users", userProfile.uid);
      await updateDoc(userRef, {
        role: selectedRole,
      });

      toast({
        title: "Role Selected",
        description: `You've been set up as a ${BUSINESS_ROLES.find(r => r.id === selectedRole)?.label}.`,
      });

      router.push("/dashboard");
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
              <strong>Note:</strong> You can change your role anytime from dashboard settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

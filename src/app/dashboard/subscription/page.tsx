"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SubscriptionPlanCard from "@/components/SubscriptionPlanCard";
import StorageUsageCard from "@/components/StorageUsageCard";
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, doc } from "firebase/firestore";
import { Loader2, ArrowLeft, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Type for subscription plans from Firestore
type Plan = {
  id?: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  storageLimit: number;
  listings: number;
  priority?: number;
  createdAt?: string;
  updatedAt?: string;
};

export default function SubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();
  const firestore = useFirestore();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const selectedPlanId = searchParams.get("plan");

  // Fetch all plans
  const plansQuery = useMemoFirebase(
    () => query(collection(firestore, "subscriptionPlans")),
    [firestore]
  );
  const { data: plans, isLoading: plansLoading } = useCollection<Plan>(plansQuery);

  // Fetch current plan details
  const currentPlanDocRef = useMemoFirebase(
    () => userProfile?.subscriptionPlanId 
      ? doc(firestore, "subscriptionPlans", userProfile.subscriptionPlanId)
      : null,
    [firestore, userProfile?.subscriptionPlanId]
  );
  const { data: currentPlan, isLoading: currentPlanLoading } = useDoc<Plan>(currentPlanDocRef);

  const handleUpgradePlan = async (planId: string) => {
    if (!userProfile) return;

    setIsUpgrading(true);
    try {
      // Here you would integrate with your payment system (Stripe, etc.)
      // For now, we'll simulate the upgrade
      console.log("[v0] Upgrading to plan:", planId);
      
      // In a real implementation, you'd:
      // 1. Call a payment API
      // 2. Update the user document with new subscription
      // 3. Show success message
      
      setIsUpgrading(false);
      router.push("/dashboard");
    } catch (error) {
      console.error("[v0] Upgrade error:", error);
      setIsUpgrading(false);
    }
  };

  const sortedPlans = plans && Array.isArray(plans)
    ? [...plans].sort((a, b) => (a?.price || 0) - (b?.price || 0))
    : [];

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const isSubscriptionActive = userProfile?.subscriptionStatus === "active";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Subscription & Billing</h1>
            <p className="text-muted-foreground">
              Manage your subscription plan and view your storage usage.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Current Subscription Status */}
        {userProfile?.subscriptionPlanId && (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Plan Name</p>
                  <p className="text-2xl font-bold">{currentPlan?.name || "Loading..."}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={isSubscriptionActive ? "bg-green-600" : "bg-amber-600"}>
                    {isSubscriptionActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Billing Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Billing Period
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-semibold">{formatDate(userProfile?.subscriptionStartDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-semibold">{formatDate(userProfile?.subscriptionEndDate)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Usage Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usage Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Storage Used</p>
                  <p className="text-2xl font-bold">
                    {userProfile?.usedStorageBytes 
                      ? (userProfile.usedStorageBytes / (1024 * 1024)).toFixed(0) 
                      : "0"} MB
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Listings</p>
                  <p className="text-2xl font-bold">{userProfile?.currentListings || 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Storage Usage Card */}
        {userProfile?.subscriptionPlanId && (
          <StorageUsageCard
            usedStorageBytes={userProfile?.usedStorageBytes || 0}
            storageLimitBytes={userProfile?.storageLimitBytes || 0}
            currentListings={userProfile?.currentListings || 0}
            maxListings={userProfile?.maxListings || 0}
          />
        )}

        {/* Available Plans Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-2">Available Plans</h2>
          <p className="text-muted-foreground mb-6">
            {userProfile?.subscriptionPlanId 
              ? "Upgrade or downgrade your plan anytime. Changes take effect immediately."
              : "Choose a plan to get started with your business account."
            }
          </p>

          {plansLoading ? (
            <div className="flex items-center justify-center min-h-96">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedPlans.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No subscription plans available. Please contact support.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {sortedPlans.map((plan) => {
                const planId = plan?.id || '';
                const isCurrentPlan = userProfile?.subscriptionPlanId === planId;
                return (
                  <div key={planId}>
                    <SubscriptionPlanCard
                      plan={{
                        id: planId,
                        name: plan?.name || '',
                        description: plan?.description || '',
                        price: plan?.price || 0,
                        features: plan?.features || [],
                        storageLimit: plan?.storageLimit || 0,
                        listings: plan?.listings || 0,
                      }}
                      isActive={isCurrentPlan}
                      showPricing={true}
                    />
                    {!isCurrentPlan && (
                      <Button
                        onClick={() => handleUpgradePlan(planId)}
                        disabled={isUpgrading}
                        className="w-full mt-4"
                      >
                        {isUpgrading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Upgrading...
                          </>
                        ) : (
                          "Upgrade Plan"
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-12 bg-secondary/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Need Help?</h3>
          <p className="text-muted-foreground mb-4">
            Have questions about your subscription or need to manage your billing?
          </p>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" asChild>
              <Link href="/pricing">View All Plans</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

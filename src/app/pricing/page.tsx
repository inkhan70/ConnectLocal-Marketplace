"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import SubscriptionPlanCard from "@/components/SubscriptionPlanCard";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query } from "firebase/firestore";
import { Loader2, ArrowLeft } from "lucide-react";

interface SubscriptionPlan {
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
}

export default function PricingPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const firestore = useFirestore();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plansQuery = useMemoFirebase(
    () => query(collection(firestore, "subscriptionPlans")),
    [firestore]
  );

  const { data: plans, isLoading, error } = useCollection<SubscriptionPlan>(plansQuery);

  const handlePlanSelect = (planId: string) => {
    if (!userProfile) {
      // Redirect to sign-in if not authenticated
      router.push(`/signin?redirect=/pricing?plan=${planId}`);
      return;
    }

    // Store selected plan and redirect to checkout/confirmation
    router.push(`/dashboard/subscription?plan=${planId}`);
  };

  const sortedPlans = plans && Array.isArray(plans)
    ? [...plans].sort((a, b) => (a?.price || 0) - (b?.price || 0))
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold">Simple, Transparent Pricing</h1>
            <p className="text-xl text-muted-foreground">
              Choose the perfect plan for your business. Upgrade or downgrade anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="container mx-auto px-4 py-16">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-lg">
            <p>Error loading pricing plans. Please try again later.</p>
          </div>
        ) : sortedPlans.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No pricing plans available yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Please check back soon.</p>
          </div>
        ) : (
          <>
            {/* Plans Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {sortedPlans.map((plan) => {
                const planId = plan?.id || '';
                return (
                  <SubscriptionPlanCard
                    key={planId}
                    plan={{
                      id: planId || '',
                      name: plan?.name || '',
                      description: plan?.description || '',
                      price: plan?.price || 0,
                      features: plan?.features || [],
                      storageLimit: plan?.storageLimit || 0,
                      listings: plan?.listings || 0,
                    }}
                    isActive={userProfile?.subscriptionPlanId === planId}
                    onSelect={handlePlanSelect}
                    showPricing={true}
                  />
                );
              })}
            </div>

            {/* FAQ Section */}
            <div className="max-w-3xl mx-auto mt-16 pt-8 border-t">
              <h2 className="text-2xl font-bold mb-8">Frequently Asked Questions</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Can I change my plan?</h3>
                  <p className="text-muted-foreground">
                    Yes! You can upgrade or downgrade your plan anytime. Changes take effect immediately.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">What is included in storage?</h3>
                  <p className="text-muted-foreground">
                    Storage includes space for product images, descriptions, and business documents. Each plan includes the specified amount of storage in gigabytes (GB).
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">How are listings counted?</h3>
                  <p className="text-muted-foreground">
                    Each unique product you add counts as one listing. You can manage up to the maximum allowed by your plan.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">Is there a free trial?</h3>
                  <p className="text-muted-foreground">
                    Sign up and start with our basic plan. You can explore features and upgrade whenever you&apos;re ready.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">What happens if I exceed my limit?</h3>
                  <p className="text-muted-foreground">
                    You&apos;ll receive notifications when approaching storage or listing limits. Upgrade your plan to increase limits or contact support for assistance.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="max-w-2xl mx-auto mt-16 text-center bg-primary/5 border border-primary/20 rounded-lg p-8">
              <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
              <p className="text-muted-foreground mb-6">
                {userProfile ? (
                  "Choose a plan above to upgrade your account and unlock more features."
                ) : (
                  "Sign up today to start your business journey on our platform."
                )}
              </p>
              {!userProfile && (
                <Button size="lg" asChild>
                  <Link href="/signup">
                    Sign Up Now
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

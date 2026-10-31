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
import { auth } from "@/firebase";
import { getIdToken } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, doc } from "firebase/firestore";
import { Loader2, ArrowLeft, Calendar, AlertCircle, CheckCircle, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_SUBSCRIPTION_PLANS, getSubscriptionStatus } from "@/lib/subscription-domain";

type Plan = {
  id?: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  storageLimit?: number;
  storageLimitBytes?: number;
  maxImages?: number | null;
  listings?: number | null;
  maxListings?: number | null;
  priority?: number;
};

export default function SubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const firestore = useFirestore();
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const isBuyer = userProfile?.role === 'buyer';

  const plansQuery = useMemoFirebase(() => query(collection(firestore, "subscriptionPlans")), [firestore]);
  const { data: plans, isLoading: plansLoading } = useCollection<Plan>(plansQuery);
  const currentPlanDocRef = useMemoFirebase(
    () => userProfile?.subscriptionPlanId ? doc(firestore, "subscriptionPlans", userProfile.subscriptionPlanId) : null,
    [firestore, userProfile?.subscriptionPlanId]
  );
  const { data: currentPlan } = useDoc<Plan>(currentPlanDocRef);

  const selectedPlanId = searchParams.get("plan");
  const statusMessage = searchParams.get("subscription");
  const checkoutSessionId = searchParams.get("session_id");

  useEffect(() => {
    if (statusMessage !== 'success' || !checkoutSessionId || !auth.currentUser) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getIdToken(auth.currentUser!, true);
        const response = await fetch('/api/subscriptions/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId: checkoutSessionId }) });
        const result = await response.json();
        if (!cancelled && result.activated) {
          toast({ title: 'Plan activated', description: 'Stripe confirmed your subscription and your account is now active.' });
          router.replace('/dashboard/subscription');
        }
      } catch (error) {
        console.error('[v0] Subscription reconciliation failed:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [checkoutSessionId, router, statusMessage, toast]);

  const handleSelectPlan = async (planId: string) => {
    if (isBuyer && planId !== 'community') {
      toast({ title: 'Community plan only', description: 'Buyer accounts do not need a paid membership plan.' });
      return;
    }
    if (!auth.currentUser) {
      router.push(`/signin?redirect=${encodeURIComponent(`/dashboard/subscription?plan=${planId}`)}`);
      return;
    }
    setIsChangingPlan(true);
    try {
      const token = await getIdToken(auth.currentUser, true);
      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId, interval: billingInterval }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Could not start subscription.');
      if (result.activated) {
        toast({ title: 'Plan activated', description: 'Your ConnectLocal plan is now active.' });
        router.replace('/dashboard/subscription');
      } else if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      }
    } catch (error: any) {
      toast({ title: 'Subscription unavailable', description: error?.message || 'Could not start subscription.', variant: 'destructive' });
    } finally {
      setIsChangingPlan(false);
    }
  };

  const openBillingPortal = async () => {
    if (!auth.currentUser) return;
    setIsChangingPlan(true);
    try {
      const token = await getIdToken(auth.currentUser, true);
      const response = await fetch('/api/subscriptions/portal', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Could not open billing management.');
      window.location.assign(result.url);
    } catch (error: any) {
      toast({ title: 'Billing unavailable', description: error?.message || 'Could not open billing management.', variant: 'destructive' });
    } finally {
      setIsChangingPlan(false);
    }
  };

  // Only platform-owned membership plans belong in customer billing. Custom
  // category/subcategory records must not be rendered as subscription plans.
  const sortedPlans = (Array.isArray(plans) && plans.length > 0
    ? plans
        .filter((plan) => DEFAULT_SUBSCRIPTION_PLANS.some((candidate) => candidate.id === plan.id) && (!isBuyer || plan.id === 'community'))
        .map((plan) => {
          const fallback = DEFAULT_SUBSCRIPTION_PLANS.find((candidate) => candidate.id === plan.id);
          return { ...fallback, ...plan, price: fallback?.price ?? plan.price, interval: fallback?.interval ?? 'month', features: Array.isArray(plan.features) ? plan.features : fallback?.features || [] };
        })
    : (isBuyer ? DEFAULT_SUBSCRIPTION_PLANS.filter((plan) => plan.id === 'community') : DEFAULT_SUBSCRIPTION_PLANS)
  ).sort((a, b) => (a.price || 0) - (b.price || 0));
  const effectiveStatus = getSubscriptionStatus(userProfile?.subscriptionStartDate, userProfile?.subscriptionEndDate);
  const isActive = effectiveStatus === 'active';
  const selectedPlan = sortedPlans.find((plan) => plan.id === selectedPlanId);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b"><div className="container mx-auto px-4 py-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
        <h1 className="text-3xl font-bold">Subscription & Billing</h1>
        <p className="text-muted-foreground mt-2">{isBuyer ? 'Buyer accounts use the free Community plan. No paid membership is required.' : 'Choose the free Community plan or change to a paid monthly or yearly plan below.'}</p>
      </div></div>

      <div className="container mx-auto px-4 py-8">
        {statusMessage === 'success' && <Alert className="mb-6"><CheckCircle className="h-4 w-4" /><AlertDescription>Payment completed. Your plan will become active as soon as Stripe confirms the subscription webhook.</AlertDescription></Alert>}
        {statusMessage === 'cancelled' && <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4" /><AlertDescription>Checkout was cancelled. Your existing plan was not changed.</AlertDescription></Alert>}
        {selectedPlan && <Alert className="mb-6"><CreditCard className="h-4 w-4" /><AlertDescription>Selected plan: <strong>{selectedPlan.name}</strong>. Continue below to start billing securely.</AlertDescription></Alert>}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" />Current Plan</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Plan</p><p className="text-2xl font-bold">{DEFAULT_SUBSCRIPTION_PLANS.find((plan) => plan.id === userProfile?.subscriptionPlanId)?.name || 'Community'}</p><div className="mt-2"><Badge className={isActive ? 'bg-green-600' : 'bg-gray-500'}>{isActive ? 'Active' : 'Community / Inactive'}</Badge></div><p className="mt-2 text-xs text-muted-foreground">Access source: {userProfile?.subscriptionSource === 'stripe' ? 'Payment subscription' : userProfile?.subscriptionSource === 'admin' ? 'Administrator grant' : 'Community/system'}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" />Billing</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">End date</p><p className="font-semibold">{userProfile?.subscriptionEndDate ? new Date(userProfile.subscriptionEndDate).toLocaleDateString() : 'Not set'}</p>{userProfile?.cancelAtPeriodEnd && <p className="text-xs text-amber-600 mt-2">Cancellation scheduled at period end.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg">Business Value</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Current features</p><ul className="mt-2 space-y-1 text-sm">{(userProfile?.subscriptionFeatures || ['Basic business profile', 'Standard marketplace visibility']).slice(0, 4).map((feature) => <li key={feature}>• {feature}</li>)}</ul></CardContent></Card>
        </div>

        <StorageUsageCard usedStorageBytes={userProfile?.usedStorageBytes || 0} storageLimitBytes={userProfile?.storageLimitBytes || 80 * 1024 * 1024} currentListings={userProfile?.currentListings || 0} maxListings={userProfile?.maxListings} />

        {isActive && userProfile?.stripeSubscriptionId && <div className="flex justify-end mt-4"><Button variant="outline" onClick={openBillingPortal} disabled={isChangingPlan}><CreditCard className="mr-2 h-4 w-4" />Manage Billing</Button></div>}

        <div className="mt-12">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{isBuyer ? 'Your plan' : 'Change your plan'}</h2>
              <p className="mt-2 text-muted-foreground">{isBuyer ? 'Your Community access is free and includes everything buyers need.' : 'Choose the free Community plan or change to a paid monthly or yearly plan below.'}</p>
            </div>
            {!isBuyer && <div>
              <p className="mb-2 text-sm font-medium">Choose billing cycle</p>
              <div className="inline-flex rounded-lg border p-1" role="group" aria-label="Billing cycle">
                <Button type="button" size="sm" variant={billingInterval === 'month' ? 'default' : 'ghost'} onClick={() => setBillingInterval('month')}>Monthly</Button>
                <Button type="button" size="sm" variant={billingInterval === 'year' ? 'default' : 'ghost'} onClick={() => setBillingInterval('year')}>Yearly <span className="ml-1 text-xs">Save 20%</span></Button>
              </div>
            </div>}
          </div>
          {plansLoading ? <div className="flex min-h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : sortedPlans.length === 0 ? <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>No plans are configured yet. An administrator can seed the recommended ConnectLocal plans.</AlertDescription></Alert> : <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">{sortedPlans.map((plan) => <SubscriptionPlanCard key={plan.id} plan={{ id: plan.id || '', name: plan.name, description: plan.description, price: plan.price, features: plan.features || [], storageLimit: plan.storageLimit, storageLimitBytes: plan.storageLimitBytes, maxImages: plan.maxImages, listings: plan.listings, maxListings: plan.maxListings, billingInterval }} isActive={userProfile?.subscriptionPlanId === plan.id} billingInterval={billingInterval} onSelect={handleSelectPlan} />)}</div>}
        </div>
      </div>
    </div>
  );
}

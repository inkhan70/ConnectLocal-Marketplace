"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { AlertCircle, CheckCircle, Zap } from "lucide-react";

interface CurrentPlanWidgetProps {
  subscriptionPlanId?: string;
  subscriptionStatus?: "active" | "inactive" | "expired";
  storageLimitBytes?: number;
  usedStorageBytes?: number;
  maxListings?: number;
  currentListings?: number;
}

interface SubscriptionPlan {
  id?: string;
  name: string;
  description: string;
  price: number;
  storageLimit: number;
  listings: number;
}

export default function CurrentPlanWidget({
  subscriptionPlanId,
  subscriptionStatus = "inactive",
  storageLimitBytes = 0,
  usedStorageBytes = 0,
  maxListings = 0,
  currentListings = 0,
}: CurrentPlanWidgetProps) {
  const firestore = useFirestore();
  const [storagePercent, setStoragePercent] = useState(0);
  const [listingPercent, setListingPercent] = useState(0);

  // Fetch current plan details
  const currentPlanDocRef = useMemoFirebase(
    () => subscriptionPlanId ? doc(firestore, "subscriptionPlans", subscriptionPlanId) : null,
    [firestore, subscriptionPlanId]
  );
  const { data: currentPlan, isLoading } = useDoc<SubscriptionPlan>(currentPlanDocRef);

  useEffect(() => {
    if (storageLimitBytes && usedStorageBytes) {
      setStoragePercent(Math.round((usedStorageBytes / storageLimitBytes) * 100));
    }
    if (maxListings && currentListings) {
      setListingPercent(Math.round((currentListings / maxListings) * 100));
    }
  }, [storageLimitBytes, usedStorageBytes, maxListings, currentListings]);

  const getStorageColor = (percent: number) => {
    if (percent >= 100) return "bg-red-500";
    if (percent >= 80) return "bg-amber-500";
    return "bg-green-500";
  };

  const getListingColor = (percent: number) => {
    if (percent >= 100) return "bg-red-500";
    if (percent >= 80) return "bg-amber-500";
    return "bg-green-500";
  };

  const getStatusIcon = () => {
    if (subscriptionStatus === "active") {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    return <AlertCircle className="h-5 w-5 text-amber-600" />;
  };

  const getStatusBadge = () => {
    switch (subscriptionStatus) {
      case "active":
        return <Badge className="bg-green-600">Active</Badge>;
      case "expired":
        return <Badge className="bg-red-600">Expired</Badge>;
      default:
        return <Badge className="bg-gray-500">Inactive</Badge>;
    }
  };

  if (!subscriptionPlanId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            No Active Subscription
          </CardTitle>
          <CardDescription>
            Upgrade your account to unlock more features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/pricing">
              Browse Plans
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-lg">{isLoading ? "Loading..." : currentPlan?.name || "Your Plan"}</CardTitle>
              <CardDescription>
                ${isLoading ? "..." : (currentPlan?.price || 0)}/month
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Storage Usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Storage Used</p>
            <p className="text-sm text-muted-foreground">
              {(usedStorageBytes / (1024 * 1024 * 1024)).toFixed(1)} GB / {storageLimitBytes} GB
            </p>
          </div>
          <Progress
            value={Math.min(storagePercent, 100)}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {storagePercent}% of storage used
          </p>
          {storagePercent >= 80 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Approaching storage limit
            </p>
          )}
        </div>

        {/* Listings Usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Product Listings</p>
            <p className="text-sm text-muted-foreground">
              {currentListings} / {maxListings}
            </p>
          </div>
          <Progress
            value={Math.min(listingPercent, 100)}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {listingPercent}% of listings used
          </p>
          {listingPercent >= 80 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Approaching listing limit
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard/subscription">
              Manage Plan
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/pricing">
              View Plans
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

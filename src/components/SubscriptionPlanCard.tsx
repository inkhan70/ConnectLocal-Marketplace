"use client";

import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  storageLimit?: number;
  storageLimitBytes?: number;
  maxImages?: number | null;
  listings?: number | null;
  maxListings?: number | null;
}

interface SubscriptionPlanCardProps {
  plan: SubscriptionPlan;
  isActive?: boolean;
  onSelect?: (planId: string) => void;
  showPricing?: boolean;
}

function formatStorage(bytes?: number, legacyGb?: number) {
  if (bytes != null) {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(bytes % 1024 ** 3 ? 1 : 0)} GB`;
    return `${Math.round(bytes / 1024 ** 2)} MB`;
  }
  return `${legacyGb || 0} GB`;
}

export default function SubscriptionPlanCard({ plan, isActive = false, onSelect, showPricing = true }: SubscriptionPlanCardProps) {
  const maxListings = plan.maxListings ?? plan.listings;
  return (
    <Card className={`relative h-full flex flex-col ${isActive ? "border-primary border-2 bg-primary/5" : ""}`}>
      {isActive && <Badge className="absolute top-4 right-4 bg-primary">Active Plan</Badge>}
      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-6">
        {showPricing && <div className="border-t pt-4"><div className="text-3xl font-bold">${plan.price}<span className="text-lg font-normal text-muted-foreground">/month</span></div></div>}
        <div className="bg-secondary/50 p-4 rounded-lg space-y-3">
          <h4 className="font-semibold text-sm">Limits</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><strong>Storage:</strong><span>{formatStorage(plan.storageLimitBytes, plan.storageLimit)}</span></div>
            <div className="flex justify-between"><strong>Images:</strong><span>{plan.maxImages == null ? "Unlimited" : plan.maxImages}</span></div>
            <div className="flex justify-between"><strong>Listings:</strong><span>{maxListings == null ? "Unlimited" : maxListings}</span></div>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Business Value</h4>
          <ul className="space-y-2">
            {plan.features.map((feature, index) => <li key={index} className="flex items-start gap-3"><Check className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" /><span className="text-sm">{feature}</span></li>)}
          </ul>
        </div>
      </CardContent>
      {onSelect && <div className="border-t p-4"><Button onClick={() => onSelect(plan.id)} disabled={isActive} className="w-full">{isActive ? "Current Plan" : plan.price === 0 ? "Use Free Plan" : "Choose Plan"}</Button></div>}
    </Card>
  );
}

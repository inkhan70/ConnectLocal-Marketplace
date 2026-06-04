"use client";

import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  storageLimit: number;
  listings: number;
  priority?: number;
}

interface SubscriptionPlanCardProps {
  plan: SubscriptionPlan;
  isActive?: boolean;
  onSelect?: (planId: string) => void;
  showPricing?: boolean;
}

export default function SubscriptionPlanCard({
  plan,
  isActive = false,
  onSelect,
  showPricing = true,
}: SubscriptionPlanCardProps) {
  return (
    <Card className={`relative h-full flex flex-col ${isActive ? "border-primary border-2 bg-primary/5" : ""}`}>
      {isActive && (
        <Badge className="absolute top-4 right-4 bg-primary">Active Plan</Badge>
      )}

      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-6">
        {/* Pricing */}
        {showPricing && (
          <div className="border-t pt-4">
            <div className="text-3xl font-bold">
              ${plan.price}
              <span className="text-lg font-normal text-muted-foreground">/month</span>
            </div>
          </div>
        )}

        {/* Limits */}
        <div className="bg-secondary/50 p-4 rounded-lg space-y-3">
          <h4 className="font-semibold text-sm">Storage & Limits</h4>
          <div className="space-y-2 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <strong>Storage:</strong>
                <span>{plan.storageLimit} GB</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {plan.storageLimit * 1024} MB available
              </div>
            </div>
            <div>
              <strong>Max Listings:</strong> {plan.listings} products
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Included Features</h4>
          <ul className="space-y-2">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-3">
                <Check className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
                <span className="text-sm text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>

      {/* Action Button */}
      {onSelect && (
        <div className="border-t p-4">
          <Button
            onClick={() => onSelect(plan.id)}
            disabled={isActive}
            className="w-full"
          >
            {isActive ? "Current Plan" : "Select Plan"}
          </Button>
        </div>
      )}
    </Card>
  );
}

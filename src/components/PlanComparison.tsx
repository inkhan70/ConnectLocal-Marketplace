"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, X } from "lucide-react";

interface Plan {
  id?: string;
  name: string;
  price: number;
  storageLimit?: number;
  storageLimitBytes?: number;
  maxImages?: number | null;
  listings?: number | null;
  maxListings?: number | null;
  features: string[];
}

interface PlanComparisonProps {
  plans: Plan[];
}

export default function PlanComparison({ plans }: PlanComparisonProps) {
  if (!plans || plans.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No plans available to compare</p>
      </div>
    );
  }

  // Get all unique features
  const allFeatures = Array.from(
    new Set(plans.flatMap((p) => p.features || []))
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Feature</TableHead>
            {plans.map((plan) => (
              <TableHead
                key={plan.id || plan.name}
                className="text-center min-w-[150px]"
              >
                <div className="font-bold text-base">{plan.name}</div>
                <div className="text-sm font-normal text-muted-foreground">
                  ${plan.price}/month
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Storage */}
          <TableRow>
            <TableCell className="font-medium">Storage</TableCell>
            {plans.map((plan) => (
              <TableCell
                key={plan.id || plan.name}
                className="text-center font-semibold"
              >
                {plan.storageLimitBytes ? (plan.storageLimitBytes >= 1024 ** 3 ? `${(plan.storageLimitBytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(plan.storageLimitBytes / 1024 ** 2)} MB`) : `${plan.storageLimit || 0} GB`}
              </TableCell>
            ))}
          </TableRow>

          {/* Listings */}
          <TableRow>
            <TableCell className="font-medium">Product Listings</TableCell>
            {plans.map((plan) => (
              <TableCell
                key={plan.id || plan.name}
                className="text-center font-semibold"
              >
                {plan.maxListings == null ? (plan.listings == null ? "Unlimited" : plan.listings) : plan.maxListings}
              </TableCell>
            ))}
          </TableRow>

          <TableRow>
            <TableCell className="font-medium">Active Images</TableCell>
            {plans.map((plan) => (
              <TableCell key={plan.id || plan.name} className="text-center font-semibold">
                {plan.maxImages == null ? "Unlimited" : plan.maxImages}
              </TableCell>
            ))}
          </TableRow>

          {/* Features */}
          {allFeatures.map((feature) => (
            <TableRow key={feature}>
              <TableCell className="font-medium text-sm">{feature}</TableCell>
              {plans.map((plan) => (
                <TableCell
                  key={plan.id || plan.name}
                  className="text-center"
                >
                  {plan.features?.includes(feature) ? (
                    <Check className="h-5 w-5 text-green-600 mx-auto" />
                  ) : (
                    <X className="h-5 w-5 text-gray-400 mx-auto" />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

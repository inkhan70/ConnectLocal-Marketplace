"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { formatStorageInfo, bytesToGB } from "@/lib/storage-utils";

interface StorageUsageCardProps {
  usedStorageBytes?: number;
  storageLimitBytes?: number;
  currentListings?: number;
  maxListings?: number;
  showAlert?: boolean;
}

export default function StorageUsageCard({
  usedStorageBytes = 0,
  storageLimitBytes = 10 * 1024 * 1024 * 1024, // Default 10GB
  currentListings = 0,
  maxListings = 5,
  showAlert = true,
}: StorageUsageCardProps) {
  const storageInfo = formatStorageInfo(usedStorageBytes, storageLimitBytes);
  const listingPercentage = maxListings > 0 ? Math.round((currentListings / maxListings) * 100) : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage & Usage</CardTitle>
        <CardDescription>Monitor your subscription limits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Storage Usage */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Storage Usage</h3>
              <span className="text-sm text-muted-foreground">
                {storageInfo.used} / {storageInfo.limit}
              </span>
            </div>
            <Progress 
              value={storageInfo.percentage} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {storageInfo.percentage}% used • {storageInfo.remaining} available
            </p>
          </div>
        </div>

        {/* Listing Usage */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Product Listings</h3>
              <span className="text-sm text-muted-foreground">
                {currentListings} / {maxListings}
              </span>
            </div>
            <Progress 
              value={listingPercentage} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {listingPercentage}% of your listing quota used
            </p>
          </div>
        </div>

        {/* Alerts */}
        {showAlert && (
          <div className="space-y-2">
            {storageInfo.isExceeded && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have exceeded your storage limit. Consider upgrading your plan or deleting unused files.
                </AlertDescription>
              </Alert>
            )}

            {!storageInfo.isExceeded && storageInfo.isApproaching && (
              <Alert variant="default" className="border-yellow-500 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  You are using {storageInfo.percentage}% of your storage. Consider upgrading soon.
                </AlertDescription>
              </Alert>
            )}

            {listingPercentage >= 80 && !storageInfo.isExceeded && (
              <Alert variant="default" className="border-yellow-500 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  You are approaching your listing limit ({currentListings}/{maxListings}). Consider upgrading to list more products.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

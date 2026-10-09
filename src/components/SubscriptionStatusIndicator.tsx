"use client";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Zap 
} from "lucide-react";

interface SubscriptionStatusIndicatorProps {
  status?: "active" | "inactive" | "expired" | "trial";
  planName?: string;
  endDate?: string;
  showAlert?: boolean;
  compact?: boolean;
}

export default function SubscriptionStatusIndicator({
  status = "inactive",
  planName = "Free Plan",
  endDate,
  showAlert = true,
  compact = false,
}: SubscriptionStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "active":
        return {
          icon: CheckCircle,
          label: "Active",
          color: "bg-green-600",
          textColor: "text-green-600",
          bgColor: "bg-green-50 dark:bg-green-950",
          borderColor: "border-green-200 dark:border-green-800",
          description: "Your subscription is active",
        };
      case "expired":
        return {
          icon: AlertTriangle,
          label: "Expired",
          color: "bg-red-600",
          textColor: "text-red-600",
          bgColor: "bg-red-50 dark:bg-red-950",
          borderColor: "border-red-200 dark:border-red-800",
          description: "Your subscription has expired. Please renew to continue.",
        };
      case "trial":
        return {
          icon: Clock,
          label: "Trial",
          color: "bg-blue-600",
          textColor: "text-blue-600",
          bgColor: "bg-blue-50 dark:bg-blue-950",
          borderColor: "border-blue-200 dark:border-blue-800",
          description: "You are on a trial subscription",
        };
      default:
        return {
          icon: Zap,
          label: "Inactive",
          color: "bg-gray-600",
          textColor: "text-gray-600",
          bgColor: "bg-gray-50 dark:bg-gray-950",
          borderColor: "border-gray-200 dark:border-gray-800",
          description: "You don't have an active subscription",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (compact) {
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  }

  const daysRemaining = endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isDaysRemaining = daysRemaining && daysRemaining > 0;
  const isExpiringsoon = isDaysRemaining && daysRemaining <= 7;

  return (
    <div className={`border rounded-lg p-4 ${config.borderColor} ${config.bgColor}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.textColor}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{config.label}</h3>
            <Badge className={config.color} variant="secondary">
              {planName}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {config.description}
          </p>

          {isDaysRemaining && (
            <p className={`text-sm mt-2 ${isExpiringsoon ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
              {isExpiringsoon && "⚠️ "}
              {daysRemaining === 0
                ? "Expires today"
                : `Expires in ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}`}
            </p>
          )}

          {endDate && (
            <p className="text-xs text-muted-foreground mt-1">
              Renewal date: {new Date(endDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Alert for expired or expiring soon */}
      {showAlert && (status === "expired" || isExpiringsoon) && (
        <Alert className={`mt-3 ${status === "expired" ? "border-red-300 bg-red-50 dark:bg-red-950" : "border-amber-300 bg-amber-50 dark:bg-amber-950"}`}>
          <AlertCircle className={`h-4 w-4 ${status === "expired" ? "text-red-600" : "text-amber-600"}`} />
          <AlertDescription className={status === "expired" ? "text-red-600" : "text-amber-600"}>
            {status === "expired"
              ? "Please renew your subscription to continue using premium features."
              : "Your subscription will expire soon. Renew now to avoid service interruption."}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

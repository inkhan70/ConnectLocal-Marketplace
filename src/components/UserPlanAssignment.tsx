"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Firestore } from "firebase/firestore";
import { auth } from "@/firebase";
import { getIdToken } from "firebase/auth";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  storageLimit: number;
  listings: number;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

interface User {
  uid: string;
  email: string;
  businessName?: string;
  fullName?: string;
  subscriptionPlanId?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionStatus?: 'active' | 'inactive' | 'expired';
  subscriptionSource?: 'admin' | 'stripe' | 'system';
}

interface UserPlanAssignmentProps {
  open: boolean;
  user: User | null;
  plans: SubscriptionPlan[];
  firestore: Firestore;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UserPlanAssignment({
  open,
  user,
  plans,
  firestore,
  onClose,
  onSuccess,
}: UserPlanAssignmentProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(user?.subscriptionPlanId || "");
  const [startDate, setStartDate] = useState<string>(user?.subscriptionStartDate || "");
  const [endDate, setEndDate] = useState<string>(user?.subscriptionEndDate || "");

  // Calculate subscription status based on dates
  const subscriptionStatus = useMemo(() => {
    if (!selectedPlanId) return "inactive";
    if (!startDate) return "inactive";

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    const now = new Date();

    if (start > now) return "inactive";
    if (end && end < now) return "expired";
    return "active";
  }, [selectedPlanId, startDate, endDate]);

  const getAdminToken = async () => {
    if (!auth.currentUser) throw new Error("Administrator authentication is required.");
    return getIdToken(auth.currentUser, true);
  };

  const handleAssign = async () => {
    if (!user || !selectedPlanId || !startDate) {
      toast({ title: "Validation Error", description: "Please select a plan and start date.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const token = await getAdminToken();
      const response = await fetch('/api/admin/subscriptions/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: user.uid, planId: selectedPlanId, startDate, endDate: endDate || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Could not assign the plan.');
      toast({ title: "Success", description: `Plan assigned to ${user.businessName || user.email}.` });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error assigning plan:", error);
      toast({ title: "Error", description: error?.message || "Could not assign the plan.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleRemovePlan = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getAdminToken();
      const response = await fetch('/api/admin/subscriptions/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: user.uid, planId: '' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Could not remove the plan.');
      toast({ title: "Success", description: `Plan removed from ${user.businessName || user.email}.` });
      onSuccess?.();
      setSelectedPlanId(""); setStartDate(""); setEndDate(""); onClose();
    } catch (error: any) {
      console.error("Error removing plan:", error);
      toast({ title: "Error", description: error?.message || "Could not remove the plan.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Subscription Plan</DialogTitle>
          <DialogDescription>
            Manually grant or revoke subscription access for {user.businessName || user.email}. This is an administrator entitlement and is separate from payment through Stripe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="plan">Select Plan</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a subscription plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} - ${plan.price}/month
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="startDate">Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="endDate">End Date (Optional)</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Leave empty for unlimited duration
            </p>
          </div>

          <div className="bg-secondary/50 p-3 rounded-lg space-y-1">
            <p className="text-sm font-medium">Subscription Status</p>
            <p className={`text-sm mt-1 font-semibold ${
              subscriptionStatus === 'active' ? 'text-green-600' :
              subscriptionStatus === 'expired' ? 'text-red-600' :
              'text-yellow-600'
            }`}>
              {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
            </p>
            <p className="text-xs text-muted-foreground">Current source: {user.subscriptionSource === 'stripe' ? 'Payment subscription' : user.subscriptionSource === 'admin' ? 'Administrator grant' : 'System/free plan'}</p>
          </div>
        </div>

        <DialogFooter className="flex gap-3">
          {user.subscriptionPlanId && (
            <Button
              variant="destructive"
              onClick={handleRemovePlan}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Plan"
              )}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Plan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

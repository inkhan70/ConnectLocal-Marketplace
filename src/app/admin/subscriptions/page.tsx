"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { collection, query } from "firebase/firestore";

interface SubscriptionPlan {
  id?: string;
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

interface UserDoc {
  uid?: string;
  email?: string;
  businessName?: string;
  subscriptionPlanId?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionStatus?: 'active' | 'inactive' | 'expired';
  [key: string]: any;
}

export default function SubscriptionsDashboard() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [stats, setStats] = useState({
    totalPlans: 0,
    activeSubscriptions: 0,
    inactiveSubscriptions: 0,
    expiredSubscriptions: 0,
  });

  const plansQuery = useMemoFirebase(() => query(collection(firestore, "subscriptionPlans")), [firestore]);
  const { data: plans, isLoading: plansLoading, error: plansError } = useCollection<SubscriptionPlan>(plansQuery);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: users, isLoading: usersLoading, error: usersError } = useCollection<UserDoc>(usersQuery);

  useEffect(() => {
    if (plansError) {
      console.error("Error fetching plans:", plansError);
      toast({
        title: "Error Loading Plans",
        description: "Could not load subscription plans.",
        variant: "destructive",
      });
    }
  }, [plansError, toast]);

  useEffect(() => {
    if (usersError) {
      console.error("Error fetching users:", usersError);
      toast({
        title: "Error Loading Users",
        description: "Could not load user subscription data.",
        variant: "destructive",
      });
    }
  }, [usersError, toast]);

  useEffect(() => {
    try {
      const plansCount = Array.isArray(plans) ? plans.length : 0;
      const usersArray = Array.isArray(users) ? users : [];
      
      const activeCount = usersArray.filter((u: UserDoc) => u?.subscriptionStatus === 'active').length;
      const inactiveCount = usersArray.filter((u: UserDoc) => u?.subscriptionStatus === 'inactive').length;
      const expiredCount = usersArray.filter((u: UserDoc) => u?.subscriptionStatus === 'expired').length;

      setStats({
        totalPlans: plansCount,
        activeSubscriptions: activeCount,
        inactiveSubscriptions: inactiveCount,
        expiredSubscriptions: expiredCount,
      });
    } catch (error) {
      console.error("[v0] Error calculating stats:", error);
    }
  }, [plans, users]);

  return (
    <div>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Subscription Management</h1>
          <p className="text-muted-foreground">
            Manage subscription plans and user assignments.
          </p>
        </div>
        <Link href="/admin/subscriptions/plans">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Manage Plans
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
          </CardHeader>
          <CardContent>
            {plansLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalPlans}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Active subscription plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{stats.activeSubscriptions}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Users with active plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inactive Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold text-yellow-600">{stats.inactiveSubscriptions}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Users without active plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expired Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{stats.expiredSubscriptions}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Plans that have expired</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
            <CardDescription>Subscription plans available in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {plansLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : Array.isArray(plans) && plans.length > 0 ? (
              <div className="space-y-2">
                {plans.map((plan) => {
                  const planId = plan?.id || '';
                  return (
                    <div key={planId} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                      <div>
                        <p className="font-medium">{plan?.name || 'Unnamed Plan'}</p>
                        <p className="text-sm text-muted-foreground">${plan?.price || 0}/month</p>
                      </div>
                      {planId && (
                        <Link href={`/admin/subscriptions/${planId}`}>
                          <Button variant="outline" size="sm">Edit</Button>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No subscription plans created yet.</p>
                <Link href="/admin/subscriptions/plans">
                  <Button variant="outline" className="mt-4">Create First Plan</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common management tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/subscriptions/plans" className="block">
              <Button className="w-full justify-start" variant="outline">
                Create / Manage Plans
              </Button>
            </Link>
            <Link href="/admin/subscriptions/assignments" className="block">
              <Button className="w-full justify-start" variant="outline">
                Assign Plans to Users
              </Button>
            </Link>
            <Button className="w-full justify-start" variant="outline" disabled>
              View Reports (Coming Soon)
            </Button>
            <Button className="w-full justify-start" variant="outline" disabled>
              Export Data (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

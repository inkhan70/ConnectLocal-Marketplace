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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2, Plus, Edit2, Package } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, deleteDoc, Firestore } from "firebase/firestore";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  storageLimit: number;
  listings: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

const handleDeletePlan = async (firestore: Firestore, planId: string, planName: string, toast: (options: any) => void) => {
  try {
    const planDocRef = doc(firestore, "subscriptionPlans", planId);
    await deleteDoc(planDocRef);
    toast({
      title: "Plan Deleted",
      description: `The subscription plan "${planName}" has been removed.`,
    });
  } catch (error) {
    toast({
      title: "Error Deleting Plan",
      description: "Could not remove the subscription plan.",
      variant: "destructive",
    });
    console.error("Error deleting plan: ", error);
  }
};

export default function PlansManagementPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const plansQuery = useMemoFirebase(() => query(collection(firestore, "subscriptionPlans")), [firestore]);
  const { data: plans, isLoading: loading, error } = useCollection<SubscriptionPlan>(plansQuery);

  useEffect(() => {
    if (error) {
      console.error("Error fetching plans from Firestore:", error);
      toast({
        title: "Error Loading Plans",
        description: "Could not load subscription plans.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return (
    <div>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground">
            Create, edit, and manage subscription plans for your marketplace.
          </p>
        </div>
        <Link href="/admin/subscriptions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Create Plan
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Plans</CardTitle>
          <CardDescription>A list of all subscription plans in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Listings</TableHead>
                <TableHead>Features</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : plans && plans.length > 0 ? (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>${plan.price.toFixed(2)}/month</TableCell>
                    <TableCell>{plan.storageLimit} GB</TableCell>
                    <TableCell>{plan.listings} listings</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {plan.features.slice(0, 2).map((feature, idx) => (
                          <span key={idx} className="text-xs bg-secondary/50 px-2 py-1 rounded">
                            {feature}
                          </span>
                        ))}
                        {plan.features.length > 2 && (
                          <span className="text-xs text-muted-foreground px-2 py-1">
                            +{plan.features.length - 2} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link href={`/admin/subscriptions/${plan.id}`}>
                        <Button variant="outline" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the <strong>{plan.name}</strong> plan. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => handleDeletePlan(firestore, plan.id, plan.name, toast)}
                            >
                              Delete Plan
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Package className="mx-auto h-10 w-10 mb-2 opacity-50" />
                    <p>No subscription plans created yet.</p>
                    <Link href="/admin/subscriptions/new">
                      <Button variant="outline" className="mt-4">Create First Plan</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

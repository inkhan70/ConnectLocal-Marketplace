"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit2, Users } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import UserPlanAssignment from "@/components/UserPlanAssignment";

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
  id: string;
  uid: string;
  email: string;
  businessName?: string;
  fullName?: string;
  subscriptionPlanId?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionStatus?: 'active' | 'inactive' | 'expired';
}

export default function AssignmentsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const plansQuery = useMemoFirebase(() => query(collection(firestore, "subscriptionPlans")), [firestore]);
  const { data: plans, isLoading: plansLoading, error: plansError } = useCollection<SubscriptionPlan>(plansQuery);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: users, isLoading: usersLoading, error: usersError } = useCollection<User>(usersQuery);

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
        description: "Could not load users.",
        variant: "destructive",
      });
    }
  }, [usersError, toast]);

  const filteredUsers = users
    ?.filter((user) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        (user.businessName?.toLowerCase().includes(searchLower) ?? false) ||
        (user.email?.toLowerCase().includes(searchLower) ?? false) ||
        (user.fullName?.toLowerCase().includes(searchLower) ?? false)
      );
    })
    .sort((a, b) => {
      // Sort by subscription status: active first, then expired, then inactive
      const statusOrder = { active: 0, inactive: 1, expired: 2 };
      const statusA = statusOrder[a.subscriptionStatus as 'active' | 'inactive' | 'expired'] ?? 1;
      const statusB = statusOrder[b.subscriptionStatus as 'active' | 'inactive' | 'expired'] ?? 1;
      return statusA - statusB;
    }) || [];

  const getPlanName = (planId?: string) => {
    return plans?.find((p) => p.id === planId)?.name || "N/A";
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "expired":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setSelectedUser(null);
  };

  const handleSuccess = () => {
    handleCloseDialog();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Assign Plans to Users</h1>
        <p className="text-muted-foreground">
          Manage subscription plan assignments for all users.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Subscriptions</CardTitle>
          <CardDescription>View and manage active subscriptions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name / Business</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Subscription Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading || plansLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.businessName || user.fullName || "N/A"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getPlanName(user.subscriptionPlanId)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(user.subscriptionStatus)}>
                        {user.subscriptionStatus 
                          ? user.subscriptionStatus.charAt(0).toUpperCase() + user.subscriptionStatus.slice(1)
                          : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.subscriptionStartDate
                        ? new Date(user.subscriptionStartDate).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {user.subscriptionEndDate
                        ? new Date(user.subscriptionEndDate).toLocaleDateString()
                        : "Unlimited"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(user)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Users className="mx-auto h-10 w-10 mb-2 opacity-50" />
                    {searchTerm ? "No users found matching your search." : "No users found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedUser && plans && (
        <UserPlanAssignment
          open={showDialog}
          user={selectedUser}
          plans={plans}
          firestore={firestore}
          onClose={handleCloseDialog}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

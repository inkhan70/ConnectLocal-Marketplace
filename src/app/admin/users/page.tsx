
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { Trash2, Loader2, Users } from "lucide-react";
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";

interface User {
    id: string; // The document ID from Firestore
    uid: string;
    email: string;
    role: string;
    businessName?: string;
    fullName?: string;
    createdAt: string;
    isAdmin?: boolean;
}

async function adminAction(user: User, action: string, extra: Record<string, unknown>, toast: (options: any) => void, authUser: any) {
    try {
        const token = await authUser.getIdToken();
        const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ uid: user.uid, action, ...extra }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Admin action failed.');
        toast({ title: 'User updated', description: 'The requested administrative change was applied.' });
    } catch (error: any) { toast({ title: 'Action failed', description: error.message, variant: 'destructive' }); }
}

export default function AdminUsersPage() {
    const { toast } = useToast();
    const { user: authUser } = useAuth();
    const firestore = useFirestore();
    
    const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
    const { data: users, isLoading: loading, error } = useCollection<User>(usersQuery);

    useEffect(() => {
        if(error) {
            console.error("Error fetching users from Firestore:", error);
            toast({
                title: "Error Loading Users",
                description: "Could not load user data from the database.",
                variant: "destructive",
            });
        }
    }, [error, toast]);
    
    const capitalizeFirstLetter = (string: string) => {
        if (!string) return string;
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-headline">User Management</h1>
        <p className="text-muted-foreground">
          View, manage, and remove user accounts from the database.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>A list of all registered users in the application.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name / Business</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                            </TableCell>
                        </TableRow>
                    ) : users && users.length > 0 ? (
                        users.map(user => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.businessName || user.fullName || "N/A"}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <Select 
                                        value={user.role} 
                                        onValueChange={(newRole) => adminAction(user, 'set_role', { role: newRole }, toast, authUser)} 
                                        disabled={user.isAdmin && users.filter(u=>u.isAdmin).length <= 1}
                                    >
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="buyer">Buyer</SelectItem>
                                            <SelectItem value="company">Company</SelectItem>
                                            <SelectItem value="wholesaler">Wholesaler</SelectItem>
                                            <SelectItem value="distributor">Distributor</SelectItem>
                                            <SelectItem value="shopkeeper">Shopkeeper</SelectItem>
                                            <SelectItem value="services">Service Provider</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <div className="mt-2">
                                      <Button size="sm" variant={user.isAdmin ? "secondary" : "outline"} onClick={() => authUser && adminAction(user, 'set_admin', { enabled: !user.isAdmin }, toast, authUser)} disabled={!authUser || (user.isAdmin && users.filter(u=>u.isAdmin).length <= 1)}>
                                        {user.isAdmin ? 'Revoke Admin' : 'Grant Admin'}
                                      </Button>
                                    </div>
                                </TableCell>
                                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right">
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="icon" disabled={user.isAdmin && users.filter(u=>u.isAdmin).length <= 1}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the account for <strong>{user.businessName || user.fullName}</strong>. This action cannot be undone.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction 
                                                className="bg-destructive hover:bg-destructive/90"
                                                onClick={() => authUser && adminAction(user, 'delete', {}, toast, authUser)}>
                                                Delete Account
                                            </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                                <Users className="mx-auto h-10 w-10 mb-2"/>
                                No users found in the database.
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

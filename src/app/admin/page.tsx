
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, ShoppingBag, Bell, Loader2 } from "lucide-react";
import Link from "next/link";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";

interface User {
  uid: string;
  role: string;
}

interface Product {
  id: string;
}

interface Order {
    id: string;
}


export default function AdminDashboardPage() {
    const firestore = useFirestore();

    const usersQuery = useMemoFirebase(() => collection(firestore, "users"), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

    const productsQuery = useMemoFirebase(() => collection(firestore, "products"), [firestore]);
    const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);
    
    const ordersQuery = useMemoFirebase(() => collection(firestore, "orders"), [firestore]);
    const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

    const businessRoles = ["company", "wholesaler", "distributor", "shopkeeper"];
    const activeBusinesses = users ? users.filter(user => businessRoles.includes(user.role)).length : 0;
    
    const isLoading = usersLoading || productsLoading || ordersLoading;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-headline">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of your application.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{users?.length || 0}</div>}
                <p className="text-xs text-muted-foreground">All registered accounts</p>
              </CardContent>
            </Card>
        </Link>
         <Link href="/admin/users">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Businesses</CardTitle>
                <Store className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                 {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{activeBusinesses}</div>}
                <p className="text-xs text-muted-foreground">All non-buyer accounts</p>
              </CardContent>
            </Card>
        </Link>
        <Link href="/dashboard/products">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Products Listed</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{products?.length || 0}</div>}
                <p className="text-xs text-muted-foreground">Total products in database</p>
              </CardContent>
            </Card>
        </Link>
        <Link href="/dashboard/orders">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{orders?.length || 0}</div>}
                <p className="text-xs text-muted-foreground">Total orders placed</p>
              </CardContent>
            </Card>
        </Link>
      </div>
       <div className="mt-8">
            <Card>
                <CardHeader>
                    <CardTitle>Recent Signups</CardTitle>
                    <CardDescription>A list of the newest members.</CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Placeholder for recent signups table */}
                    <div className="text-center text-muted-foreground py-8">
                        User activity will be displayed here.
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

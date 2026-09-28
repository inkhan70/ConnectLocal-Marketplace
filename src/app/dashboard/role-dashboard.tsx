"use client";

import Link from "next/link";
import { CalendarDays, ClipboardList, MessageSquare, Package, PlusCircle, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const content = {
  doctor: { title: "Care workspace", description: "Manage appointments, patient requests, and your professional profile.", actions: ["Appointments", "Patient requests", "Availability"] },
  shopkeeper: { title: "Store workspace", description: "Keep your catalog, stock, orders, and customer conversations moving.", actions: ["Inventory", "Orders", "Customers"] },
  services: { title: "Service workspace", description: "Turn local enquiries into scheduled jobs with a clear service pipeline.", actions: ["New enquiries", "Upcoming jobs", "Service profile"] },
  default: { title: "Business workspace", description: "Manage your listings, orders, customers, and marketplace presence.", actions: ["Listings", "Orders", "Customers"] },
};

export function RoleDashboard() {
  const { userProfile } = useAuth();
  const isDoctor = userProfile?.subcategoryId === "health_doctor";
  const kind = isDoctor ? "doctor" : userProfile?.role === "shopkeeper" ? "shopkeeper" : userProfile?.role === "services" ? "services" : "default";
  const copy = content[kind];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-sm font-medium text-primary">{userProfile?.businessName || userProfile?.fullName || "Your workspace"}</p><h1 className="text-2xl font-bold font-headline">{copy.title}</h1><p className="text-muted-foreground">{copy.description}</p></div>
        <Button asChild><Link href="/dashboard/products"><PlusCircle className="mr-2 h-4 w-4" />Add listing</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {copy.actions.map((action, index) => { const Icon = [CalendarDays, ClipboardList, Users][index]; return <Card key={action}><CardHeader className="flex-row items-center gap-3 space-y-0"><Icon className="h-5 w-5 text-primary" /><CardTitle className="text-base">{action}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{index === 0 ? "0" : "—"}</p><p className="text-xs text-muted-foreground">Connect your workflow here</p></CardContent></Card>; })}
      </div>
      <Card><CardHeader><CardTitle>Quick actions</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3"><Button variant="outline" asChild><Link href="/dashboard/products"><Package className="mr-2 h-4 w-4" />Manage listings</Link></Button><Button variant="outline" asChild><Link href="/dashboard/chat"><MessageSquare className="mr-2 h-4 w-4" />Open messages</Link></Button></CardContent></Card>
    </div>
  );
}

export default RoleDashboard;

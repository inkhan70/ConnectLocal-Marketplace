"use client";

import Link from "next/link";
import { CalendarDays, Car, ClipboardList, Package, PlusCircle, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const metrics = [
  { label: "Open work orders", value: "0", note: "Jobs currently in the workshop", icon: ClipboardList },
  { label: "Today's bookings", value: "0", note: "Inspections and repairs scheduled", icon: CalendarDays },
  { label: "Parts to restock", value: "0", note: "Items below your stock threshold", icon: Package },
];

export function AutomotiveDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Vehicle service center</p>
          <h1 className="font-headline text-2xl font-bold">Auto repair workspace</h1>
          <p className="text-muted-foreground">Manage engine repairs, vehicle inspections, service jobs, and parts for your workshop.</p>
        </div>
        <Button asChild><Link href="/dashboard/products"><PlusCircle className="mr-2 h-4 w-4" />Add service or part</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map(({ label, value, note, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{value}</div><p className="text-xs text-muted-foreground">{note}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" />Workshop shortcuts</CardTitle><CardDescription>Keep your most important repair-shop workflows close at hand.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Button variant="outline" className="justify-start" asChild><Link href="/dashboard/products"><Car className="mr-2 h-4 w-4" />Vehicle services</Link></Button>
          <Button variant="outline" className="justify-start" asChild><Link href="/dashboard/orders"><ClipboardList className="mr-2 h-4 w-4" />Service requests</Link></Button>
          <Button variant="outline" className="justify-start" asChild><Link href="/dashboard/chat"><CalendarDays className="mr-2 h-4 w-4" />Customer messages</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

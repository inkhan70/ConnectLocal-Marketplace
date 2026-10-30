"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type Provider = { id: string; label: string; countries: string[]; currencies: string[]; marketplace: boolean; platform: boolean; status: string; enabled?: boolean; note: string };
export default function ProviderManagerPage() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!user) return; user.getIdToken().then((token) => fetch("/api/admin/payments/providers", { headers: { Authorization: `Bearer ${token}` } })).then((response) => response.json()).then((data) => setProviders(data.providers || [])).finally(() => setLoading(false)); }, [user]);
  const update = async (provider: Provider, enabled: boolean) => { if (!user) return; const token = await user.getIdToken(); await fetch("/api/admin/payments/providers", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ providerId: provider.id, enabled, currencies: provider.currencies }) }); setProviders((current) => current.map((item) => item.id === provider.id ? { ...item, enabled } : item)); };
  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return <div className="mx-auto flex max-w-5xl flex-col gap-6"><div><h1 className="text-2xl font-bold">Payment Provider Manager</h1><p className="text-muted-foreground">Control provider availability by country without exposing credentials or changing live payment records.</p></div><div className="grid gap-4">{providers.map((provider) => <Card key={provider.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{provider.label}</CardTitle><CardDescription>{provider.note}</CardDescription></div><Switch checked={provider.enabled !== false && provider.status === "enabled"} onCheckedChange={(checked) => update(provider, checked)} aria-label={`Enable ${provider.label}`} /></div></CardHeader><CardContent className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Countries: {provider.countries.join(", ")}</Badge><Badge variant="outline">Currencies: {provider.currencies.join(", ")}</Badge><Badge variant={provider.marketplace ? "secondary" : "outline"}>{provider.marketplace ? "Marketplace" : "Platform or review only"}</Badge></CardContent></Card>)}</div></div>;
}

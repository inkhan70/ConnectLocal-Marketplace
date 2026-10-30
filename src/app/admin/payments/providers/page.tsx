"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, Save } from "lucide-react";

type Provider = { id: string; label: string; countries: string[]; currencies: string[]; marketplace: boolean; platform: boolean; status: string; enabled?: boolean; note: string };

export default function ProviderManagerPage() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [country, setCountry] = useState("PK");
  const [providerId, setProviderId] = useState("jazzcash");
  const [currencies, setCurrencies] = useState("PKR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch("/api/admin/payments/providers", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    setProviders(data.providers || []);
    setLoading(false);
  };
  useEffect(() => { load().catch(() => setLoading(false)); }, [user]);

  const update = async (provider: Provider, enabled: boolean) => {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch("/api/admin/payments/providers", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ providerId: provider.id, enabled, currencies: provider.currencies }) });
    setProviders((current) => current.map((item) => item.id === provider.id ? { ...item, enabled } : item));
  };

  const addConfiguration = async () => {
    if (!user) return;
    setSaving(true); setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/payments/providers", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ providerId, country: country.toUpperCase(), enabled: true, currencies: currencies.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save configuration.");
      setMessage(`Saved ${data.providerId} for ${data.country}.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save configuration."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return <div className="mx-auto flex max-w-5xl flex-col gap-6">
    <div><h1 className="text-2xl font-bold">Payment Provider Manager</h1><p className="text-muted-foreground">Configure provider availability by country. Credentials stay server-side and provider approval is required before enabling settlement.</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Add provider configuration</CardTitle><CardDescription>Choose a supported provider, country, and currencies. This creates an availability configuration; it does not bypass provider onboarding.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4 md:flex-row md:items-end"><label className="flex flex-1 flex-col gap-2 text-sm font-medium">Provider<select className="h-10 rounded-md border bg-background px-3" value={providerId} onChange={(event) => setProviderId(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label><label className="flex flex-1 flex-col gap-2 text-sm font-medium">Country code<Input value={country} maxLength={2} onChange={(event) => setCountry(event.target.value.toUpperCase())} /></label><label className="flex flex-1 flex-col gap-2 text-sm font-medium">Currencies<Input value={currencies} placeholder="USD, PKR" onChange={(event) => setCurrencies(event.target.value)} /></label><Button onClick={addConfiguration} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button></CardContent>{message && <p className="px-6 pb-5 text-sm text-muted-foreground" role="status">{message}</p>}</Card>
    <div className="grid gap-4">{providers.map((provider) => <Card key={provider.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{provider.label}</CardTitle><CardDescription>{provider.note}</CardDescription></div><Switch checked={provider.enabled !== false && provider.status === "enabled"} onCheckedChange={(checked) => update(provider, checked)} aria-label={`Enable ${provider.label}`} /></div></CardHeader><CardContent className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Countries: {provider.countries.join(", ")}</Badge><Badge variant="outline">Currencies: {provider.currencies.join(", ")}</Badge><Badge variant={provider.marketplace ? "secondary" : "outline"}>{provider.marketplace ? "Marketplace" : "Platform or review only"}</Badge></CardContent></Card>)}</div>
  </div>;
}

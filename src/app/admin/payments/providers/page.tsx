"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, Loader2, Plus, Save, XCircle } from "lucide-react";

type Check = { key: string; label: string; ok: boolean; detail?: string };
type Readiness = { method: string; available: boolean; reason: string | null; checks: Check[] };
type Provider = { id: string; label: string; countries: string[]; currencies: string[]; marketplace: boolean; platform: boolean; status: string; enabled?: boolean; merchantApproved?: boolean; note: string; readiness?: Readiness };
type Config = { id: string; providerId: string; country: string; enabled?: boolean; merchantApproved?: boolean; currencies?: string[]; webhookVerifiedAt?: string | null };

export default function ProviderManagerPage() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [checkCountry, setCheckCountry] = useState("PK");
  const [checkCurrency, setCheckCurrency] = useState("PKR");
  const [country, setCountry] = useState("PK");
  const [providerId, setProviderId] = useState("safepay");
  const [currencies, setCurrencies] = useState("PKR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/payments/providers?country=${checkCountry}&currency=${checkCurrency}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const data = await response.json();
    setProviders(data.providers || []);
    setConfigs(data.configurations || []);
    setLoading(false);
  }, [user, checkCountry, checkCurrency]);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);

  // Sends ONLY the field that changed, so nothing else (e.g. an existing approval) is touched.
  const save = async (body: Record<string, unknown>) => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch("/api/admin/payments/providers", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to save.");
    await load();
  };

  const addConfiguration = async () => {
    setSaving(true); setMessage("");
    try {
      await save({ providerId, country: country.toUpperCase(), currencies: currencies.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean) });
      setMessage(`Saved ${providerId} for ${country.toUpperCase()}. A new configuration starts as "not approved" - tick Merchant approved below once the provider has approved you.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save configuration."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Payment Provider Manager</h1>
        <p className="text-muted-foreground">Credentials stay server-side. A provider is shown to buyers only when every requirement below is met.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What buyers see</CardTitle>
          <CardDescription>Check any seller region. This uses the same rules as the buyer&apos;s checkout and the order API. Changes can take a few minutes to reach buyers (cached for 1 minute).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">Country<Input className="w-24" value={checkCountry} maxLength={2} onChange={(event) => setCheckCountry(event.target.value.toUpperCase())} /></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Currency<Input className="w-28" value={checkCurrency} maxLength={3} onChange={(event) => setCheckCurrency(event.target.value.toUpperCase())} /></label>
          <p className="text-sm text-muted-foreground">Buyers there see: <strong>Cash on Delivery{providers.filter((provider) => provider.readiness?.available).map((provider) => `, ${provider.label}`).join("")}</strong></p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">{provider.label} {provider.readiness?.available ? <Badge>Visible to buyers</Badge> : <Badge variant="outline">Hidden</Badge>}</CardTitle>
                  <CardDescription>{provider.note}</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={provider.merchantApproved === true} onChange={(event) => save({ providerId: provider.id, country: "GLOBAL", merchantApproved: event.target.checked })} /> Merchant approved</label>
                  <Switch checked={provider.enabled === true} onCheckedChange={(checked) => save({ providerId: provider.id, country: "GLOBAL", enabled: checked })} aria-label={`Enable ${provider.label}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Countries: {provider.countries.join(", ")}</Badge>
                <Badge variant="outline">Currencies: {provider.currencies.join(", ")}</Badge>
                <Badge variant={provider.marketplace ? "secondary" : "outline"}>{provider.marketplace ? "Marketplace" : "Platform or review only"}</Badge>
              </div>
              {provider.readiness && provider.id !== "cod" && (
                <ul className="space-y-1">
                  {provider.readiness.checks.map((check) => (
                    <li key={check.key} className="flex items-start gap-2">
                      {check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                      <span>{check.label}{!check.ok && check.detail ? <span className="block text-xs text-muted-foreground">{check.detail}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved configurations</CardTitle>
          <CardDescription>A country configuration overrides the global one for that country only for the fields it sets. Webhook verification applies to the whole integration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {configs.length === 0 && <p className="text-sm text-muted-foreground">Nothing saved yet.</p>}
          {configs.map((config) => (
            <div key={config.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{config.providerId} · {config.country}</p>
                <p className="text-xs text-muted-foreground">{config.currencies?.length ? config.currencies.join(", ") : "any currency"}{config.webhookVerifiedAt ? ` · webhook verified ${new Date(config.webhookVerifiedAt).toLocaleString()}` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={config.merchantApproved === true} onChange={(event) => save({ providerId: config.providerId, country: config.country, merchantApproved: event.target.checked })} /> Approved</label>
                <Switch checked={config.enabled === true} onCheckedChange={(checked) => save({ providerId: config.providerId, country: config.country, enabled: checked })} aria-label={`Enable ${config.id}`} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Add country configuration</CardTitle>
          <CardDescription>Restrict a provider to a country and currencies. It never removes an approval that already exists.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium">Provider<select className="h-10 rounded-md border bg-background px-3" value={providerId} onChange={(event) => setProviderId(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium">Country code<Input value={country} maxLength={2} onChange={(event) => setCountry(event.target.value.toUpperCase())} /></label>
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium">Currencies<Input value={currencies} placeholder="USD, PKR" onChange={(event) => setCurrencies(event.target.value)} /></label>
          <Button onClick={addConfiguration} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button>
        </CardContent>
        {message && <p className="px-6 pb-5 text-sm text-muted-foreground" role="status">{message}</p>}
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

type Settings = { country: string; currency: string; providers: Array<{ id: string; label: string; marketplace: boolean; status: string; note: string; currencies: string[] }>; accounts: Array<{ provider: string; status: string }> };

export default function PaymentSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) => fetch("/api/payments/settings", { headers: { Authorization: `Bearer ${token}` } })).then((response) => response.json()).then((data) => { setSettings(data); setCountry(data.country || ""); setCurrency(data.currency || ""); }).catch(() => undefined);
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/payments/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ country, currency }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSettings((current) => current ? { ...current, country, currency } : current);
      toast({ title: "Payment settings saved", description: "Provider availability will use this verified business country." });
    } catch (error) { toast({ title: "Could not save settings", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (!settings) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return <div className="mx-auto flex max-w-4xl flex-col gap-6">
    <div><h1 className="text-2xl font-bold">Payment Settings</h1><p className="text-muted-foreground">Configure your verified business country, payout currency, and provider readiness.</p></div>
    <Card><CardHeader><CardTitle>Business payment profile</CardTitle><CardDescription>IP detection is only a suggestion. Your selected country must match your verified business information.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end"><label className="flex flex-1 flex-col gap-2 text-sm font-medium">Country code<Input value={country} maxLength={2} onChange={(event) => setCountry(event.target.value.toUpperCase())} /></label><label className="flex flex-1 flex-col gap-2 text-sm font-medium">Currency<Input value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">{settings.providers.map((provider) => <Card key={provider.id}><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="text-lg">{provider.label}</CardTitle><Badge variant={provider.status === "enabled" ? "secondary" : "outline"}>{provider.status === "enabled" ? "Available" : "Review required"}</Badge></div><CardDescription>{provider.note}</CardDescription></CardHeader><CardContent className="flex items-center justify-between gap-4"><span className="text-sm text-muted-foreground">{provider.marketplace ? `Marketplace: ${provider.currencies.join(", ")}` : "Marketplace settlement not enabled"}</span>{provider.marketplace && <Button variant="outline" disabled><ShieldCheck className="mr-2 h-4 w-4" />Verification</Button>}</CardContent></Card>)}</div>
  </div>;
}

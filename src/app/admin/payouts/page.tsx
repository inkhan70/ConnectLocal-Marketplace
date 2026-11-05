"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Totals = { currency: string; heldMinor: number; availableMinor: number; paidOutMinor: number };
type Seller = { sellerId: string; name: string; totals: Totals[]; account: { method: string; accountTitle: string; bankName: string; accountNumber: string } | null };
type Payout = { id: string; sellerName: string; amountMinor: number; currency: string; reference: string; method: string; accountMasked: string; orderCount: number; paidAt: string | null };
type Clawback = { orderId: string; sellerId: string; amountMinor: number; currency: string };
type FeeConfig = { commissionPercent: number; serviceChargePercent: number };

const money = (minor: number, currency: string) => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((minor || 0) / 100); } catch { return `${currency} ${((minor || 0) / 100).toFixed(2)}`; } };

export default function AdminPayoutsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<{ sellers: Seller[]; payouts: Payout[]; clawbacks: Clawback[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [feeConfig, setFeeConfig] = useState<FeeConfig>({ commissionPercent: 0, serviceChargePercent: 0 });
  const [feeBusy, setFeeBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const r = await fetch("/api/admin/payouts", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Could not load payouts.");
      setData(body); setError(null);
      const settings = await fetch('/api/admin/payments/settings', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const settingsBody = await settings.json();
      if (settings.ok) setFeeConfig({ commissionPercent: Number(settingsBody.commissionPercent || 0), serviceChargePercent: Number(settingsBody.serviceChargePercent || 0) });
    } catch (e: any) { setError(e.message); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const saveFeeConfig = async () => {
    if (!user) return;
    setFeeBusy(true);
    try {
      const token = await user.getIdToken();
      const r = await fetch('/api/admin/payments/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(feeConfig) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Could not save payment settings.');
      setFeeConfig({ commissionPercent: Number(body.commissionPercent), serviceChargePercent: Number(body.serviceChargePercent) });
      toast({ title: 'Payment charges updated', description: 'New online payments will use these settings.' });
    } catch (e: any) { toast({ title: 'Settings not saved', description: e.message, variant: 'destructive' }); }
    finally { setFeeBusy(false); }
  };

  const markPaid = async (seller: Seller, currency: string) => {
    if (!user) return;
    const key = `${seller.sellerId}:${currency}`;
    setBusy(key);
    try {
      const token = await user.getIdToken();
      const r = await fetch("/api/admin/payouts", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sellerId: seller.sellerId, currency, reference: refs[key] || "" }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Could not record the payout.");
      toast({ title: "Payout recorded", description: `${money(body.amountMinor, currency)} for ${body.orderCount} order(s).` });
      setRefs((c) => ({ ...c, [key]: "" }));
      await load();
    } catch (e: any) { toast({ title: "Payout not recorded", description: e.message, variant: "destructive" }); }
    finally { setBusy(null); }
  };

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-2xl font-bold">Member payouts</h1><p className="text-muted-foreground">Transfer each member&apos;s ready balance to their account, then enter the transfer reference here. Nothing is sent from this screen: it records the transfer you made and prevents paying the same orders twice.</p></div>

      <Card><CardHeader><CardTitle>Payment charges</CardTitle><CardDescription>Configure the platform commission and service charge deducted from each new successful online payment. Existing ledger rows are not changed.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-end gap-4">
        <label className="grid gap-2 text-sm"><span>Member commission (%)</span><Input type="number" min="0" max="50" step="0.01" value={feeConfig.commissionPercent} onChange={(e) => setFeeConfig((current) => ({ ...current, commissionPercent: Number(e.target.value) }))} /></label>
        <label className="grid gap-2 text-sm"><span>Service charge (%)</span><Input type="number" min="0" max="50" step="0.01" value={feeConfig.serviceChargePercent} onChange={(e) => setFeeConfig((current) => ({ ...current, serviceChargePercent: Number(e.target.value) }))} /></label>
        <Button onClick={saveFeeConfig} disabled={feeBusy}>{feeBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save charges</Button>
        <p className="basis-full text-xs text-muted-foreground">Each rate is capped at 50%. Commission is calculated on goods; service charge is calculated on the order total. The combined fee cannot exceed the payment.</p>
      </CardContent></Card>

      {data.clawbacks.length > 0 && (
        <Card className="border-amber-500/50"><CardHeader><CardTitle>Refunded after payout ({data.clawbacks.length})</CardTitle><CardDescription>These orders were refunded to the customer after the member was already paid. Recover the amount from the member.</CardDescription></CardHeader>
          <CardContent><ul className="space-y-1 text-sm">{data.clawbacks.map((c) => <li key={c.orderId}>Order {c.orderId} · {money(c.amountMinor, c.currency)} · member {c.sellerId}</li>)}</ul></CardContent></Card>
      )}

      <Card><CardHeader><CardTitle>Ready to pay</CardTitle></CardHeader><CardContent className="space-y-4">
        {data.sellers.length === 0 && <p className="text-sm text-muted-foreground">No member has an online balance right now.</p>}
        {data.sellers.map((s) => s.totals.map((t) => {
          const key = `${s.sellerId}:${t.currency}`;
          return (
            <div key={key} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.account ? `${s.account.method} · ${s.account.accountTitle}${s.account.bankName ? ` · ${s.account.bankName}` : ""} · ${s.account.accountNumber}` : "No payout details added yet"}</p></div>
                <div className="text-right"><p className="text-lg font-bold">{money(t.availableMinor, t.currency)}</p><p className="text-xs text-muted-foreground">+ {money(t.heldMinor, t.currency)} on hold</p></div>
              </div>
              {t.availableMinor > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Input className="max-w-xs" placeholder="Transfer reference (bank / wallet transaction id)" value={refs[key] || ""} onChange={(e) => setRefs((c) => ({ ...c, [key]: e.target.value }))} />
                  <Button onClick={() => markPaid(s, t.currency)} disabled={!s.account || busy === key}>{busy === key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark as paid</Button>
                </div>)}
            </div>);
        }))}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Recent payouts</CardTitle></CardHeader><CardContent>
        {data.payouts.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
          <ul className="space-y-2 text-sm">{data.payouts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <span className="font-medium">{p.sellerName} · {money(p.amountMinor, p.currency)} · {p.orderCount} order(s)</span>
              <span className="text-muted-foreground">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : ""} · {p.method} {p.accountMasked} · ref {p.reference}</span>
            </li>))}</ul>)}
      </CardContent></Card>
    </div>
  );
}

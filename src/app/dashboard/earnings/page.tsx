"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet } from "lucide-react";

type Totals = { currency: string; heldMinor: number; availableMinor: number; paidOutMinor: number; count: number };
type Payout = { id: string; amountMinor: number; currency: string; reference: string; method: string; orderCount: number; paidAt: string | null };
type Account = { method: string; accountTitle: string; bankName: string; maskedNumber: string } | null;

const money = (minor: number, currency: string) => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((minor || 0) / 100); } catch { return `${currency} ${((minor || 0) / 100).toFixed(2)}`; } };
const METHODS = [{ v: "bank", l: "Bank account / IBAN" }, { v: "jazzcash", l: "JazzCash" }, { v: "easypaisa", l: "Easypaisa" }, { v: "raast", l: "Raast (mobile number)" }];

export default function EarningsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<{ totals: Totals[]; payouts: Payout[]; account: Account; feePercent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ method: "bank", accountTitle: "", accountNumber: "", bankName: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const r = await fetch("/api/payments/earnings", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Could not load earnings.");
      setData(body); setError(null);
    } catch (e: any) { setError(e.message); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const r = await fetch("/api/payments/payout-account", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Could not save.");
      toast({ title: "Payout details saved", description: "We will send your earnings to this account." });
      setForm({ method: form.method, accountTitle: "", accountNumber: "", bankName: "" });
      await load();
    } catch (e: any) { toast({ title: "Could not save payout details", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Wallet className="h-6 w-6" /> Earnings &amp; payouts</h1>
        <p className="text-muted-foreground">Online payments (card, PayPal, Safepay) are collected by the platform and paid out to you after the customer receives the order. Cash on Delivery is collected by you directly and is not listed here.</p>
      </div>

      {data.totals.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No online payments yet. When a customer pays online for one of your orders it appears here.</CardContent></Card>
      ) : data.totals.map((t) => (
        <div key={t.currency} className="grid gap-4 sm:grid-cols-3">
          <Card><CardHeader><CardDescription>Ready to pay out</CardDescription><CardTitle>{money(t.availableMinor, t.currency)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Orders handed over to the customer.</CardContent></Card>
          <Card><CardHeader><CardDescription>On hold</CardDescription><CardTitle>{money(t.heldMinor, t.currency)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Paid, but not yet delivered / picked up.</CardContent></Card>
          <Card><CardHeader><CardDescription>Paid out so far</CardDescription><CardTitle>{money(t.paidOutMinor, t.currency)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{t.count} online order(s) in total.</CardContent></Card>
        </div>
      ))}
      {data.feePercent > 0 && <p className="text-xs text-muted-foreground">Amounts are after the {data.feePercent}% platform fee.</p>}

      <Card>
        <CardHeader>
          <CardTitle>Where should we pay you?</CardTitle>
          <CardDescription>{data.account ? `Current: ${data.account.method} · ${data.account.accountTitle} · ${data.account.maskedNumber}` : "Add your payout details to receive your earnings."} Only the administrator who makes the transfer can see the full number.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Method</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {METHODS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select></div>
          <div className="space-y-2"><Label>Account holder name</Label><Input value={form.accountTitle} onChange={(e) => setForm({ ...form, accountTitle: e.target.value })} placeholder="As shown on the account" /></div>
          {form.method === "bank" && <div className="space-y-2"><Label>Bank name</Label><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. Meezan Bank" /></div>}
          <div className="space-y-2"><Label>{form.method === "bank" ? "IBAN / account number" : "Registered mobile number"}</Label><Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder={form.method === "bank" ? "PK00 BANK 0000 0000 0000 0000" : "03XX XXXXXXX"} inputMode="text" autoComplete="off" /></div>
          <div className="sm:col-span-2"><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save payout details</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payout history</CardTitle></CardHeader>
        <CardContent>
          {data.payouts.length === 0 ? <p className="text-sm text-muted-foreground">No payouts yet.</p> : (
            <ul className="space-y-2 text-sm">{data.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <span className="font-medium">{money(p.amountMinor, p.currency)} · {p.orderCount} order(s)</span>
                <span className="text-muted-foreground">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : ""} · {p.method} · ref {p.reference}</span>
              </li>))}</ul>)}
        </CardContent>
      </Card>
    </div>
  );
}

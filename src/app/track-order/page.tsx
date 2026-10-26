"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardCopy, ShieldCheck, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { processPayment } from "@/lib/payment-utils";
import { ContactSeller } from "@/components/ContactSeller";

interface TrackedOrder {
  id: string; status: string; paymentStatus?: string; paymentMethod?: "cod" | "stripe" | "paypal";
  deliveryMethod?: "pickup" | "seller_delivery"; deliveryAddress?: { address?: string; city?: string; state?: string } | null;
  items: { name?: string; varietyName?: string; quantity: number; price?: number }[];
  subtotal?: number; deliveryFee?: number; totalCost: number; currency?: string; createdAt?: string; sellerName: string;
}

const label = (s: string) => s.replaceAll("_", " ");
const FINAL = ["completed", "cancelled", "refunded"];

export default function TrackOrderPage() {
  const { toast } = useToast();
  const [orderId, setOrderId] = useState("");
  const [key, setKey] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [sellerContact, setSellerContact] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [recent, setRecent] = useState<{ orderId: string; key: string; at: string }[]>([]);
  const captured = useRef(false);

  const load = useCallback(async (id: string, k: string, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const r = await fetch(`/api/orders/track?orderId=${encodeURIComponent(id)}`, { headers: { "x-guest-key": k }, cache: "no-store" });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || "Could not load the order.");
      setOrder(body.order); setCode(body.verificationCode); setSellerContact(body.sellerContact || null); setError(null);
    } catch (e: any) { setError(e.message); } finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get("orderId") || ""; const k = p.get("k") || "";
    try { setRecent(JSON.parse(localStorage.getItem("connectlocal.guestOrders") || "[]")); } catch { /* ignore */ }
    if (!id || !k) { setLoading(false); return; }
    setOrderId(id); setKey(k);

    (async () => {
      // PayPal returns the customer here with ?payment=paypal&token=<paypal order id>; capture it server-side.
      const paypalToken = p.get("token");
      if (p.get("payment") === "paypal" && paypalToken && !captured.current) {
        captured.current = true;
        const r = await fetch("/api/payments/paypal/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id, paypalOrderId: paypalToken, guestKey: k }) });
        const b = await r.json().catch(() => ({}));
        toast(r.ok ? { title: "Payment received", description: "Thank you! Your order is confirmed." } : { title: "Payment not completed", description: b?.error || "Please try again.", variant: "destructive" });
      } else if (p.get("payment") === "success") {
        const confirmation = await fetch("/api/payments/stripe/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id, guestKey: k }) });
        const confirmationBody = await confirmation.json().catch(() => ({}));
        toast(confirmation.ok && confirmationBody.status === "paid"
          ? { title: "Payment received", description: "Your order is now confirmed." }
          : { title: "Payment still processing", description: "Stripe has not confirmed this payment yet. Refresh shortly.", variant: "destructive" });
      } else if (p.get("payment") === "cancelled") {
        toast({ title: "Payment cancelled", description: "Your order is reserved. You can pay again below.", variant: "destructive" });
      }
      await load(id, k);
    })();
  }, [load, toast]);

  // Keep the status fresh while the order is still moving (payment confirmation, seller progress).
  useEffect(() => {
    if (!order || !orderId || !key || FINAL.includes(order.status)) return;
    const t = setInterval(() => load(orderId, key, true), 15000);
    return () => clearInterval(t);
  }, [order, orderId, key, load]);

  async function payNow() {
    if (!order) return;
    setPaying(true);
    try {
      const result = await processPayment({ method: order.paymentMethod || "cod", orderId, guestKey: key });
      if (!result.success) throw new Error(result.error || "Payment could not be started.");
      const url = result.checkoutUrl || result.links?.find(l => l.rel === "approve" || l.rel === "payer-action")?.href;
      if (url) window.location.assign(url); else await load(orderId, key);
    } catch (e: any) { toast({ title: "Payment unavailable", description: e.message, variant: "destructive" }); } finally { setPaying(false); }
  }

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast({ title: "Copied", description: "Verification code copied." }));
  const currency = order?.currency || "USD";
  const money = (n?: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(n || 0));

  if (loading) return <div className="container mx-auto flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!orderId || !key) {
    return <div className="container mx-auto max-w-xl px-4 py-10 space-y-4">
      <h1 className="text-2xl font-bold font-headline">Track your order</h1>
      <p className="text-muted-foreground">Open the tracking link you received after checkout. Orders placed as a guest on this device:</p>
      {recent.length ? recent.map(o => <Card key={o.orderId}><CardContent className="flex items-center justify-between p-4"><div><p className="font-mono text-xs">{o.orderId.slice(0, 8)}…</p><p className="text-xs text-muted-foreground">{new Date(o.at).toLocaleString()}</p></div><Button asChild size="sm"><Link href={`/track-order?orderId=${encodeURIComponent(o.orderId)}&k=${encodeURIComponent(o.key)}`}>Open</Link></Button></CardContent></Card>) : <p className="text-sm text-muted-foreground">No guest orders were found on this device.</p>}
    </div>;
  }

  if (error || !order) return <div className="container mx-auto max-w-xl px-4 py-10 space-y-3"><h1 className="text-2xl font-bold font-headline">Order not available</h1><p className="text-muted-foreground">{error || "We could not find this order."}</p><p className="text-sm text-muted-foreground">Check that you opened the full link from checkout. The link contains your private order key.</p></div>;

  return <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
    <div className="flex items-start justify-between gap-2"><div><h1 className="text-2xl font-bold font-headline">Your order</h1><p className="text-sm text-muted-foreground">From {order.sellerName} · <span className="font-mono">{order.id.slice(0, 8)}…</span></p></div><div className="flex items-center gap-2"><Badge variant={["completed", "paid"].includes(order.status) ? "default" : "secondary"}>{label(order.status)}</Badge><Button size="icon" variant="ghost" onClick={() => load(orderId, key)} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button></div></div>

    {order.status === "pending_payment" && <Card className="border-amber-500/50"><CardHeader><CardTitle>Payment pending</CardTitle><CardDescription>Your order is reserved until payment is completed.</CardDescription></CardHeader><CardContent><Button onClick={payNow} disabled={paying}>{paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Pay {money(order.totalCost)} with {order.paymentMethod === "paypal" ? "PayPal" : "card"}</Button></CardContent></Card>}

    {code && <Card className="border-primary/50"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Your private verification code</CardTitle><CardDescription>{order.deliveryMethod === "pickup" ? "Show this code to the seller when you collect your order." : "Give this code to the seller only when your order arrives."} The seller types it in to complete the handover. Never share it earlier.</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between rounded-md bg-muted p-4"><span className="font-mono text-3xl font-bold tracking-widest">{code}</span><Button variant="outline" size="icon" onClick={() => copy(code)} aria-label="Copy code"><ClipboardCopy className="h-4 w-4" /></Button></div></CardContent></Card>}

    <Card><CardHeader><CardTitle>Items</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
      {order.items.map((i, n) => <div key={n} className="flex justify-between"><span>{i.name || i.varietyName} × {i.quantity}</span><span>{money(Number(i.price) * Number(i.quantity))}</span></div>)}
      <div className="flex justify-between border-t pt-2 text-muted-foreground"><span>Delivery</span><span>{money(order.deliveryFee)}</span></div>
      <div className="flex justify-between font-semibold"><span>Total</span><span>{money(order.totalCost)}</span></div>
      <p className="pt-2 text-muted-foreground">{order.deliveryMethod === "pickup" ? "Customer pickup" : `Delivery to ${[order.deliveryAddress?.address, order.deliveryAddress?.city, order.deliveryAddress?.state].filter(Boolean).join(", ")}`} · Payment: {order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod} ({order.paymentStatus === "paid" ? "paid" : label(order.paymentStatus || "pending")})</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Need help with your order?</CardTitle><CardDescription>Contact {order.sellerName} directly. Never share your verification code in a message.</CardDescription></CardHeader><CardContent><ContactSeller seller={sellerContact} message={`Hello ${order.sellerName}, I have a question about my ConnectLocal order ${order.id.slice(0, 8)}.`} /></CardContent></Card>
    <p className="text-xs text-muted-foreground">Keep this page's link private: it is your proof of ownership for this order. <Link className="underline" href="/signup">Create an account</Link> to keep all your orders in one place.</p>
  </div>;
}

"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Package, ClipboardCopy, CheckCircle2, Truck, RotateCcw, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { processPayment } from '@/lib/payment-utils';
import { ContactSeller } from '@/components/ContactSeller';
import { usePublicBusiness } from '@/hooks/use-public-business';

interface Order {
  id: string; buyerId: string; businessId: string; buyerName: string; buyerPhone?: string; items: any[]; totalCost: number; orderDate: Timestamp;
  status: string; pickupCode?: string; paymentMethod?: 'cod' | 'jazzcash' | 'easypaisa' | 'stripe' | 'paypal'; deliveryMethod?: 'seller_delivery' | 'pickup'; paymentStatus?: string; deliveryAddress?: any;
}

const label = (status: string) => status.replaceAll('_', ' ');

/** Buyer -> seller: WhatsApp / call the seller about this order (seller's published number). */
function ContactSellerForOrder({ order }: { order: Order }) {
  const { data: seller } = usePublicBusiness(order.businessId);
  return <ContactSeller size="sm" hideWhenEmpty seller={seller} message={`Hello ${seller?.businessName || ''}, I have a question about my ConnectLocal order ${order.id.slice(0, 8)}.`} />;
}

export default function OrdersPage() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const isBusiness = !!userProfile?.role && userProfile.role !== 'buyer';
  // Buyer: shows their private handover code. Seller: types the code the buyer reads out to complete the handover.
  const [codeView, setCodeView] = useState<{ orderId: string; code: string } | null>(null);
  const [verifyFor, setVerifyFor] = useState<{ order: Order; kind: 'pickup' | 'delivery' } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [busy, setBusy] = useState(false);
  const ordersQuery = useMemoFirebase(() => {
    if (!user) return null;
    const fieldPath = isBusiness ? 'businessId' : 'buyerId';
    // Single-field filter only: a filter + orderBy would need a composite index that must be created by hand in
    // Firebase, and a missing index makes the whole page crash. Newest-first sorting is done below instead.
    return query(collection(firestore, 'orders'), where(fieldPath, '==', user.uid));
  }, [user, firestore, isBusiness]);
  const { data: rawOrders, isLoading: ordersLoading, error: ordersError } = useCollection<Order>(ordersQuery);
  const orders = useMemo(() => rawOrders ? [...rawOrders].sort((a, b) => (b.orderDate?.toMillis?.() ?? Number.MAX_SAFE_INTEGER) - (a.orderDate?.toMillis?.() ?? Number.MAX_SAFE_INTEGER)) : rawOrders, [rawOrders]);

  async function action(order: Order, actionName: string, extra: Record<string, unknown> = {}) {
    if (!user) return;
    try {
      const token = await (user as any).getIdToken();
      const response = await fetch(`/api/orders/${order.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: actionName, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Action failed.');
      toast({ title: 'Order updated', description: `Order is now ${label(data.status)}.` });
      return true;
    } catch (error: any) { toast({ title: 'Unable to update order', description: error.message, variant: 'destructive' }); return false; }
  }


  async function pay(order: Order) {
    if (!user || !order.paymentStatus || order.status !== 'pending_payment') return;
    try {
      const token = await (user as any).getIdToken();
      const result = await processPayment({ method: (order as any).paymentMethod || 'cod', orderId: order.id }, token);
      if (!result.success) throw new Error(result.error || 'Payment could not be started.');
      const checkoutUrl = (result as any).checkoutUrl || result.links?.find(link => link.rel === 'approve')?.href;
      if (checkoutUrl) window.location.assign(checkoutUrl);
      else toast({ title: 'Payment started', description: 'Complete the payment with the selected provider, then return to your orders.' });
    } catch (error: any) { toast({ title: 'Payment unavailable', description: error.message, variant: 'destructive' }); }
  }

  // Returning from a payment provider: PayPal needs a server-side capture; Stripe is confirmed by its webhook.
  useEffect(() => {
    if (!user) return;
    const p = new URLSearchParams(window.location.search);
    const orderId = p.get('orderId'); const payment = p.get('payment'); const token = p.get('token');
    if (!orderId || !payment) return;
    (async () => {
      if (payment === 'paypal' && token) {
        const idToken = await (user as any).getIdToken();
        const r = await fetch('/api/payments/paypal/capture', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ orderId, paypalOrderId: token }) });
        const b = await r.json().catch(() => ({}));
        toast(r.ok ? { title: 'Payment received', description: 'Thank you! Your order is confirmed.' } : { title: 'Payment not completed', description: b?.error || 'Please try again.', variant: 'destructive' });
      } else if (payment === 'success') toast({ title: 'Payment submitted', description: 'We are confirming it with the payment provider.' });
      else if (payment === 'cancelled') toast({ title: 'Payment cancelled', description: 'Your order is reserved. Press Pay to try again.', variant: 'destructive' });
      window.history.replaceState({}, '', '/dashboard/orders');
    })();
  }, [user, toast]);

  async function showCode(order: Order) {
    if (!user) return;
    try {
      const token = await (user as any).getIdToken();
      const r = await fetch(`/api/orders/${order.id}/verification`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Could not load your code.');
      setCodeView({ orderId: order.id, code: b.code });
    } catch (error: any) { toast({ title: 'Code unavailable', description: error.message, variant: 'destructive' }); }
  }

  async function submitVerification() {
    if (!verifyFor) return;
    setBusy(true);
    try {
      const ok = await action(verifyFor.order, 'verify_handover', { code: verifyCode });
      if (ok) { setVerifyFor(null); setVerifyCode(''); }
    } finally { setBusy(false); }
  }

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast({ title: 'Copied', description: 'Verification code copied.' }));

  return <div>
    <div className="mb-6"><h1 className="text-2xl font-bold font-headline">{isBusiness ? 'Incoming Orders' : 'My Purchase History'}</h1><p className="text-muted-foreground">{isBusiness ? 'Fulfill orders, verify pickup and manage customer requests.' : 'Track payment, delivery and pickup securely.'}</p></div>
    {ordersError && <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">We could not load your orders right now. Please refresh the page; if it keeps happening, contact support.</div>}
    <Card><CardHeader><CardTitle>All Orders</CardTitle><CardDescription>Order actions are validated by the server.</CardDescription></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Order ID</TableHead><TableHead>{isBusiness ? 'Customer' : 'Seller'}</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Handover</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
      <TableBody>{ordersLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow> : orders?.length ? orders.map(order => <TableRow key={order.id}>
        <TableCell className="font-medium" title={order.id}>{order.id.substring(0, 8)}...</TableCell><TableCell>{isBusiness ? order.buyerName : 'Business'}</TableCell><TableCell>{order.orderDate?.toDate ? order.orderDate.toDate().toLocaleDateString() : '—'}</TableCell><TableCell>${Number(order.totalCost || 0).toFixed(2)}</TableCell>
        <TableCell><Badge variant={['completed','paid'].includes(order.status) ? 'default' : 'secondary'}>{label(order.status)}</Badge></TableCell>
        <TableCell className="text-xs text-muted-foreground">{['paid','processing','ready_for_pickup','out_for_delivery'].includes(order.status) ? (isBusiness ? (['ready_for_pickup','out_for_delivery'].includes(order.status) ? 'Awaiting buyer code' : '—') : <Button size="sm" variant="outline" onClick={() => showCode(order)}><ShieldCheck className="mr-1 h-4 w-4" />Show code</Button>) : '—'}</TableCell>
        <TableCell className="text-right"><div className="flex flex-wrap justify-end gap-2">
          {isBusiness
            ? <ContactSeller size="sm" hideWhenEmpty seller={{ contactWhatsapp: order.buyerPhone, countryCode: userProfile?.countryCode, businessName: order.buyerName }} message={`Hello ${order.buyerName || ''}, this is ${userProfile?.businessName || 'your seller'} about your ConnectLocal order ${order.id.slice(0, 8)}.`} />
            : <ContactSellerForOrder order={order} />}
          {isBusiness && order.status === 'paid' && <Button size="sm" variant="outline" onClick={() => action(order, 'transition', { status: 'processing' })}>Process</Button>}
          {isBusiness && order.status === 'processing' && <Button size="sm" variant="outline" onClick={() => action(order, 'transition', { status: order.deliveryMethod === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery' })}>{order.deliveryMethod === 'pickup' ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <Truck className="mr-1 h-4 w-4" />}Next</Button>}
          {isBusiness && order.status === 'ready_for_pickup' && <Button size="sm" onClick={() => { setVerifyCode(''); setVerifyFor({ order, kind: 'pickup' }); }}><ShieldCheck className="mr-1 h-4 w-4" />Verify pickup</Button>}
          {isBusiness && order.status === 'out_for_delivery' && <Button size="sm" onClick={() => { setVerifyCode(''); setVerifyFor({ order, kind: 'delivery' }); }}><ShieldCheck className="mr-1 h-4 w-4" />Verify delivery</Button>}
          {!isBusiness && order.status === 'pending_payment' && <Button size="sm" onClick={() => pay(order)}>Pay</Button>}
          {!isBusiness && order.status === 'delivered' && <Button size="sm" onClick={() => action(order, 'confirm_delivery')}><CheckCircle2 className="mr-1 h-4 w-4" />Confirm</Button>}
          {!isBusiness && ['paid','processing','ready_for_pickup','out_for_delivery','delivered','picked_up','completed'].includes(order.status) && <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt('Reason for refund request'); if (reason) action(order, 'refund_request', { reason }); }}><RotateCcw className="mr-1 h-4 w-4" />Refund</Button>}
        </div></TableCell>
      </TableRow>) : <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground"><Package className="mx-auto h-10 w-10 mb-2" />No orders found.</TableCell></TableRow>}</TableBody></Table>
    </CardContent></Card>
    <Dialog open={!!codeView} onOpenChange={o => !o && setCodeView(null)}><DialogContent><DialogHeader><DialogTitle>Your private verification code</DialogTitle><DialogDescription>Give this code to the seller only when you receive your order (or collect it). The seller types it in to complete the handover. Never share it earlier or send it in chat.</DialogDescription></DialogHeader>
      {codeView && <div className="flex items-center justify-between rounded-md bg-muted p-4"><span className="font-mono text-3xl font-bold tracking-widest">{codeView.code}</span><Button variant="outline" size="icon" onClick={() => copy(codeView.code)} aria-label="Copy code"><ClipboardCopy className="h-4 w-4" /></Button></div>}</DialogContent></Dialog>
    <Dialog open={!!verifyFor} onOpenChange={o => { if (!o) { setVerifyFor(null); setVerifyCode(''); } }}><DialogContent><DialogHeader><DialogTitle>{verifyFor?.kind === 'delivery' ? 'Verify delivery' : 'Verify pickup'}</DialogTitle><DialogDescription>Ask the buyer for their verification code and enter it here. The order completes only if it matches.</DialogDescription></DialogHeader>
      <Input value={verifyCode} onChange={e => setVerifyCode(e.target.value.toUpperCase())} placeholder="Buyer's code" autoCapitalize="characters" autoComplete="off" className="text-center font-mono text-lg tracking-widest" maxLength={12} />
      <Button onClick={submitVerification} disabled={busy || verifyCode.trim().length < 4}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Complete handover</Button></DialogContent></Dialog>
  </div>;
}

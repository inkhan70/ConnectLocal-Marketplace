"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ClipboardCopy, CheckCircle2, Truck, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { processPayment } from '@/lib/payment-utils';

interface Order {
  id: string; buyerId: string; businessId: string; buyerName: string; items: any[]; totalCost: number; orderDate: Timestamp;
  status: string; pickupCode: string; paymentMethod?: 'cod' | 'jazzcash' | 'easypaisa' | 'stripe' | 'paypal'; deliveryMethod?: 'seller_delivery' | 'pickup'; paymentStatus?: string; deliveryAddress?: any;
}

const label = (status: string) => status.replaceAll('_', ' ');

export default function OrdersPage() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const isBusiness = !!userProfile?.role && userProfile.role !== 'buyer';
  const ordersQuery = useMemoFirebase(() => {
    if (!user) return null;
    const fieldPath = isBusiness ? 'businessId' : 'buyerId';
    return query(collection(firestore, 'orders'), where(fieldPath, '==', user.uid), orderBy('orderDate', 'desc'));
  }, [user, firestore, isBusiness]);
  const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

  async function action(order: Order, actionName: string, extra: Record<string, unknown> = {}) {
    if (!user) return;
    try {
      const token = await (user as any).getIdToken();
      const response = await fetch(`/api/orders/${order.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: actionName, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Action failed.');
      toast({ title: 'Order updated', description: `Order is now ${label(data.status)}.` });
    } catch (error: any) { toast({ title: 'Unable to update order', description: error.message, variant: 'destructive' }); }
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

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast({ title: 'Copied', description: 'Pickup code copied.' }));

  return <div>
    <div className="mb-6"><h1 className="text-2xl font-bold font-headline">{isBusiness ? 'Incoming Orders' : 'My Purchase History'}</h1><p className="text-muted-foreground">{isBusiness ? 'Fulfill orders, verify pickup and manage customer requests.' : 'Track payment, delivery and pickup securely.'}</p></div>
    <Card><CardHeader><CardTitle>All Orders</CardTitle><CardDescription>Order actions are validated by the server.</CardDescription></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Order ID</TableHead><TableHead>{isBusiness ? 'Customer' : 'Seller'}</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Pickup</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
      <TableBody>{ordersLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow> : orders?.length ? orders.map(order => <TableRow key={order.id}>
        <TableCell className="font-medium" title={order.id}>{order.id.substring(0, 8)}...</TableCell><TableCell>{isBusiness ? order.buyerName : 'Business'}</TableCell><TableCell>{order.orderDate?.toDate ? order.orderDate.toDate().toLocaleDateString() : '—'}</TableCell><TableCell>${Number(order.totalCost || 0).toFixed(2)}</TableCell>
        <TableCell><Badge variant={['completed','paid'].includes(order.status) ? 'default' : 'secondary'}>{label(order.status)}</Badge></TableCell>
        <TableCell><div className="flex items-center gap-1 font-mono text-xs">{order.pickupCode}<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(order.pickupCode)}><ClipboardCopy className="h-3 w-3" /></Button></div></TableCell>
        <TableCell className="text-right"><div className="flex justify-end gap-2">
          {isBusiness && order.status === 'paid' && <Button size="sm" variant="outline" onClick={() => action(order, 'transition', { status: 'processing' })}>Process</Button>}
          {isBusiness && order.status === 'processing' && <Button size="sm" variant="outline" onClick={() => action(order, 'transition', { status: order.deliveryMethod === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery' })}>{order.deliveryMethod === 'pickup' ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <Truck className="mr-1 h-4 w-4" />}Next</Button>}
          {isBusiness && order.status === 'ready_for_pickup' && <Button size="sm" onClick={() => { const code = window.prompt('Enter the buyer pickup code'); if (code) action(order, 'verify_pickup', { pickupCode: code }); }}>Verify</Button>}
          {!isBusiness && order.status === 'pending_payment' && <Button size="sm" onClick={() => pay(order)}>Pay</Button>}
          {!isBusiness && order.status === 'delivered' && <Button size="sm" onClick={() => action(order, 'confirm_delivery')}><CheckCircle2 className="mr-1 h-4 w-4" />Confirm</Button>}
          {!isBusiness && ['paid','processing','ready_for_pickup','out_for_delivery','delivered','picked_up','completed'].includes(order.status) && <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt('Reason for refund request'); if (reason) action(order, 'refund_request', { reason }); }}><RotateCcw className="mr-1 h-4 w-4" />Refund</Button>}
        </div></TableCell>
      </TableRow>) : <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground"><Package className="mx-auto h-10 w-10 mb-2" />No orders found.</TableCell></TableRow>}</TableBody></Table>
    </CardContent></Card>
  </div>;
}

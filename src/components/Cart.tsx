"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "./ui/button";
import { useCart } from "@/contexts/CartContext";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Trash2, Plus, Minus, Loader2, MapPin, Store } from "lucide-react";
import Image from "next/image";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { ItemDelivery } from "./ItemDelivery";
import type { Address } from "./ItemDelivery";
import { GuestCheckoutForm } from "./GuestCheckoutForm";
import type { GuestCheckoutData } from "./GuestCheckoutForm";
import images from '@/app/lib/placeholder-images.json';
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { processPayment } from '@/lib/payment-utils';

type PaymentMethod = 'cod' | 'stripe' | 'paypal';

/** Remembers guest orders on this device so a guest can come back to their order and verification code. */
function rememberGuestOrder(orderId: string, key: string) {
  try {
    const list = JSON.parse(localStorage.getItem('connectlocal.guestOrders') || '[]');
    const next = [{ orderId, key, at: new Date().toISOString() }, ...list.filter((o: any) => o.orderId !== orderId)].slice(0, 20);
    localStorage.setItem('connectlocal.guestOrders', JSON.stringify(next));
  } catch { /* storage unavailable: the tracking link still works */ }
}

type DeliveryMethod = 'seller_delivery' | 'pickup';

export function Cart() {
  const { cart, cartCount, updateQuantity, removeFromCart, subtotal, clearCart } = useCart();
  const { t } = useLanguage();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { methods: paymentOptions } = usePaymentMethods();

  const [deliveryAddress, setDeliveryAddress] = useState<Address>({ address: "", city: "", state: "" });
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('seller_delivery');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showCheckoutOptions, setShowCheckoutOptions] = useState(false);

  const sellers = [...new Set(cart.map(item => item.userId))];

  // If the chosen provider is not available on this deployment, fall back to cash on delivery.
  useEffect(() => {
    if (!paymentOptions.some(m => m.value === paymentMethod)) setPaymentMethod('cod');
  }, [paymentOptions, paymentMethod]);

  const createOrder = async (guest?: GuestCheckoutData) => {
    if (!cart.length) return;
    if (sellers.length !== 1) {
      toast({ title: 'One seller per checkout', description: 'For transaction safety, please checkout items from one seller at a time.', variant: 'destructive' });
      return;
    }
    if (deliveryMethod === 'seller_delivery' && (!deliveryAddress.address || !deliveryAddress.city || !deliveryAddress.state)) {
      toast({ title: 'Missing Address', description: 'Enter a complete delivery address or choose customer pickup.', variant: 'destructive' });
      return;
    }

    setIsPlacingOrder(true);
    try {
      const effectiveAddress = guest ? { address: guest.address, city: guest.city, state: guest.state } : deliveryAddress;
      const effectivePaymentMethod = (guest?.paymentMethod || paymentMethod) as PaymentMethod;
      if (deliveryMethod === 'seller_delivery' && (!effectiveAddress.address || !effectiveAddress.city || !effectiveAddress.state)) {
        throw new Error('A complete delivery address is required.');
      }

      const destination = await new Promise<{ latitude?: number; longitude?: number }>((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
          () => resolve({}),
          { timeout: 5000, maximumAge: 5 * 60 * 1000 }
        );
      });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user) headers.Authorization = `Bearer ${await (user as any).getIdToken()}`;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cart.map(item => ({ productId: item.productId, varietyId: item.varietyId, quantity: item.quantity })),
          deliveryMethod,
          paymentMethod: effectivePaymentMethod,
          deliveryAddress: deliveryMethod === 'seller_delivery' ? effectiveAddress : null,
          destination,
          buyerName: userProfile?.fullName || user?.displayName || user?.email || undefined,
          guest: guest ? { name: guest.fullName, email: guest.email, phone: guest.phone } : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create the order.');

      const guestKey: string | undefined = result.guestKey;
      const trackUrl = guestKey ? `/track-order?orderId=${encodeURIComponent(result.orderId)}&k=${encodeURIComponent(guestKey)}` : null;
      if (guestKey) rememberGuestOrder(result.orderId, guestKey);

      if (result.paymentRequired) {
        // Online payment: signed-in buyers authenticate with their token, guests with their order key.
        const token = user ? await (user as any).getIdToken() : null;
        const payment = await processPayment({ method: effectivePaymentMethod, orderId: result.orderId, guestKey }, token);
        if (!payment.success) {
          clearCart();
          setShowCheckoutOptions(false);
          toast({ title: 'Order reserved; payment still pending', description: payment.error || 'Open your order to retry payment.', variant: 'destructive' });
          if (trackUrl) router.push(trackUrl);
          else router.push('/dashboard/orders');
          return;
        }
        const redirectUrl = payment.checkoutUrl || payment.links?.find(link => link.rel === 'approve' || link.rel === 'payer-action')?.href;
        clearCart();
        setShowCheckoutOptions(false);
        if (redirectUrl) {
          window.location.assign(redirectUrl);
          return;
        }
      }

      clearCart();
      setShowCheckoutOptions(false);
      toast({
        title: 'Order confirmed',
        description: user
          ? `Order placed. Your private handover code is in Dashboard → Orders; give it to the seller only when you receive your order.`
          : `Order placed. Save your tracking page: it holds your private handover code.`,
      });
      router.push(trackUrl || '/dashboard/orders');
    } catch (error: any) {
      toast({ title: 'Checkout failed', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      setShowCheckoutOptions(true);
      return;
    }
    await createOrder();
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-1">{cartCount}</Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="px-6"><SheetTitle>Shopping Cart</SheetTitle><SheetDescription>Review your items and proceed to a secure checkout.</SheetDescription></SheetHeader>
        {cartCount > 0 ? (
          <ScrollArea className="flex-1"><div className="px-6 py-4 space-y-5">
            {sellers.length > 1 && <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Your cart contains products from {sellers.length} sellers. Checkout currently processes one seller per transaction.</div>}
            {cart.map(item => (
              <div key={item.varietyId} className="flex items-start gap-4">
                <Image src={item.image || images.varieties.variety_thumb} alt={item.varietyName} width={72} height={72} className="rounded-md object-cover" />
                <div className="flex-1"><p className="font-semibold">{item.varietyName}</p><p className="text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
                  <div className="mt-2 flex items-center gap-2"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.varietyId, item.quantity - 1)}><Minus className="h-4 w-4" /></Button><span>{item.quantity}</span><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.varietyId, item.quantity + 1)}><Plus className="h-4 w-4" /></Button></div>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeFromCart(item.varietyId)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-semibold text-lg"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>

            <div className="space-y-2"><p className="text-sm font-medium">Fulfillment</p><Select value={deliveryMethod} onValueChange={v => setDeliveryMethod(v as DeliveryMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="seller_delivery">Seller delivery</SelectItem><SelectItem value="pickup">Customer pickup</SelectItem></SelectContent></Select></div>
            {deliveryMethod === 'seller_delivery' ? <ItemDelivery address={deliveryAddress} onAddressChange={setDeliveryAddress} /> : <div className="rounded-md border p-3 text-sm"><div className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4" />Pickup code required</div><p className="mt-1 text-muted-foreground">You get a private code after ordering. Give it to the seller only when you collect your order; the seller types it in to complete the handover.</p></div>}

            <div className="space-y-2"><p className="text-sm font-medium">Payment</p><Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as PaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentOptions.map(method => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Online payments are confirmed by the payment provider, never by the browser.</p></div>

            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" onClick={handleCheckout} disabled={isPlacingOrder || sellers.length !== 1}>{isPlacingOrder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{isPlacingOrder ? 'Creating secure order...' : t('item_detail.confirm_order')}</Button>
          </div></ScrollArea>
        ) : <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center"><ShoppingCart className="h-16 w-16 text-muted-foreground" /><p className="text-muted-foreground">Your cart is empty.</p></div>}

        <Dialog open={showCheckoutOptions} onOpenChange={setShowCheckoutOptions}><DialogContent className="w-[calc(100vw-1rem)] max-w-[600px] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-4 sm:p-6">
          <DialogHeader className="pr-8"><DialogTitle>Checkout Options</DialogTitle><DialogDescription>Create an account for order history, or continue as a guest.</DialogDescription></DialogHeader>
          <div className="min-w-0 space-y-4"><div className="rounded-lg border p-3 sm:p-4 space-y-3"><div className="flex items-center gap-2 font-semibold"><Store className="h-4 w-4 shrink-0" />Create Account</div><p className="text-sm text-muted-foreground">Track orders, save purchase history and use your member benefits.</p><Button asChild className="w-full"><Link href="/signup">Register Now</Link></Button></div>
          <div className="rounded-lg border p-3 sm:p-4 space-y-4"><h3 className="font-semibold">Continue as Guest</h3><GuestCheckoutForm methods={paymentOptions} onSubmit={async data => { setDeliveryMethod('seller_delivery'); await createOrder(data); }} isLoading={isPlacingOrder} /></div></div>
        </DialogContent></Dialog>
      </SheetContent>
    </Sheet>
  );
}

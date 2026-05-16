
"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "./ui/button";
import { useCart } from "@/contexts/CartContext";
import { Badge } from "./ui/badge";
import { ShoppingCart, Trash2, Plus, Minus, Loader2 } from "lucide-react";
import Image from "next/image";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { ItemDelivery } from "./ItemDelivery";
import type { Address } from "./ItemDelivery";
import { GuestCheckoutForm } from "./GuestCheckoutForm";
import type { GuestCheckoutData } from "./GuestCheckoutForm";
import images from '@/app/lib/placeholder-images.json';
import { useAuth, UserProfile } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, increment, getDoc, runTransaction } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { v4 as uuidv4 } from 'uuid';
import Link from "next/link";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CartItem {
  productId: string;
  productName: string;
  varietyId: string;
  varietyName: string;
  price: number;
  image: string;
  quantity: number;
  userId: string; // Business owner's UID
}

export function Cart() {
  const { cart, cartCount, updateQuantity, removeFromCart, subtotal, clearCart } = useCart();
  const { t } = useLanguage();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [deliveryAddress, setDeliveryAddress] = useState<Address>({
    address: "",
    city: "",
    state: "",
  });
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showCheckoutOptions, setShowCheckoutOptions] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");

  const handleGuestCheckout = async (guestData: GuestCheckoutData) => {
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Your cart is empty.",
        variant: "destructive"
      });
      return;
    }

    setIsPlacingOrder(true);
    const businessId = cart[0].userId;
    const guestOrderId = uuidv4();

    try {
      const ordersCollection = collection(firestore, 'orders');
      const totalItemsInOrder = cart.reduce((sum, item) => sum + item.quantity, 0);

      const guestOrder = {
        id: guestOrderId,
        buyerId: 'guest_' + uuidv4(), // Anonymous guest ID
        buyerName: guestData.fullName,
        buyerEmail: guestData.email,
        buyerPhone: guestData.phone,
        businessId: businessId,
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          varietyId: item.varietyId,
          varietyName: item.varietyName,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
        })),
        deliveryAddress: `${guestData.address}, ${guestData.city}, ${guestData.state}`,
        totalCost: subtotal + 5.00,
        orderDate: serverTimestamp(),
        status: "Pending",
        paymentMethod: guestData.paymentMethod,
        isGuestOrder: true,
        pickupCode: Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase(),
      };

      await addDoc(ordersCollection, guestOrder);

      toast({
        title: "Order Placed!",
        description: `Your guest order has been confirmed. A confirmation email will be sent to ${guestData.email}.`,
      });
      
      clearCart();
      setShowCheckoutOptions(false);
    } catch (error: any) {
      console.error("Error placing guest order: ", error);
      toast({
        title: "Error Placing Order",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!user || !userProfile) {
      setShowCheckoutOptions(true);
      return;
    }
    if (!deliveryAddress.address || !deliveryAddress.city || !deliveryAddress.state) {
      toast({
        title: "Missing Address",
        description: "Please provide a complete delivery address.",
        variant: "destructive"
      });
      return;
    }
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Your cart is empty.",
        variant: "destructive"
      });
      return;
    }

    setIsPlacingOrder(true);

    const businessId = cart[0].userId;
    const businessDocRef = doc(firestore, "users", businessId);
    const userDocRef = doc(firestore, "users", user.uid);

    try {
      // Use a transaction to ensure all reads and writes are atomic.
      await runTransaction(firestore, async (transaction) => {
        const businessDoc = await transaction.get(businessDocRef);
        const userDoc = await transaction.get(userDocRef);

        if (!businessDoc.exists()) {
          throw new Error("Business owner profile not found.");
        }
        if (!userDoc.exists()) {
          throw new Error("Your user profile could not be found.");
        }
        
        const businessProfile = businessDoc.data() as UserProfile;
        const buyerProfile = userDoc.data() as UserProfile;
        
        const orderId = uuidv4();
        const totalItemsInOrder = cart.reduce((sum, item) => sum + item.quantity, 0);

        const newOrder = {
          id: orderId,
          buyerId: user.uid,
          buyerName: buyerProfile.fullName || user.email,
          businessId: businessId,
          items: cart.map(item => ({
            productId: item.productId,
            productName: item.productName,
            varietyId: item.varietyId,
            varietyName: item.varietyName,
            quantity: item.quantity,
            price: item.price,
            image: item.image,
          })),
          deliveryAddress: `${deliveryAddress.address}, ${deliveryAddress.city}, ${deliveryAddress.state}`,
          totalCost: subtotal + 5.00,
          orderDate: serverTimestamp(),
          status: "Pending",
          pickupCode: Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase(),
        };

        const ordersCollection = collection(firestore, 'orders');
        transaction.set(doc(ordersCollection, orderId), newOrder);

        const isFirstPurchase = !buyerProfile.purchaseHistory || buyerProfile.purchaseHistory.length === 0;
        const currentTotalItems = buyerProfile.totalItemsPurchased || 0;
        const newTotalItems = currentTotalItems + totalItemsInOrder;
        const coinsEarned = Math.floor(newTotalItems / 4) - Math.floor(currentTotalItems / 4);
        
        const userProfileUpdates: any = {
          purchaseHistory: arrayUnion(orderId),
          totalItemsPurchased: increment(totalItemsInOrder),
        };

        if (isFirstPurchase) {
          userProfileUpdates.balance = increment(5.00);
        }
        if (coinsEarned > 0) {
          userProfileUpdates.ghostCoins = increment(coinsEarned);
        }
        
        transaction.update(userDocRef, userProfileUpdates);
      });
      
      toast({
        title: "Order Placed!",
        description: "Your order has been successfully placed. Check your dashboard for details."
      });
      clearCart();

    } catch (error: any) {
      console.error("Error placing order: ", error);
      toast({
        title: "Error Placing Order",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };


  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-1"
            >
              {cartCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>Shopping Cart</SheetTitle>
          <SheetDescription>
            Review your items and proceed to checkout.
          </SheetDescription>
        </SheetHeader>
        
        {cartCount > 0 ? (
          <ScrollArea className="flex-1">
            <div className="px-6 py-4">
              <div className="flex flex-col gap-4">
                {cart.map((item) => (
                  <div key={item.varietyId} className="flex items-start gap-4">
                    <Image
                      src={item.image || images.varieties.variety_thumb}
                      alt={item.varietyName}
                      width={80}
                      height={80}
                      className="rounded-md object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{item.varietyName}</p>
                      <p className="text-sm text-muted-foreground">
                        ${item.price.toFixed(2)}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.varietyId, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span>{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.varietyId, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeFromCart(item.varietyId)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                  <div className="flex justify-between font-semibold text-lg">
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                  </div>

                  <ItemDelivery
                    address={deliveryAddress}
                    onAddressChange={setDeliveryAddress}
                  />

                  <p className="text-sm text-muted-foreground">Transportation Cost: <span className="font-bold text-foreground">$5.00</span></p>
                  
                  <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" onClick={handleConfirmOrder} disabled={isPlacingOrder}>
                      {isPlacingOrder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isPlacingOrder ? "Placing Order..." : t('item_detail.confirm_order')}
                  </Button>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">Your cart is empty.</p>
          </div>
        )}
        
        {/* Checkout Options Dialog */}
        <Dialog open={showCheckoutOptions} onOpenChange={setShowCheckoutOptions}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Checkout Options</DialogTitle>
              <DialogDescription>
                Choose how you want to proceed with your order
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Register Option */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Create Account (Recommended)</h3>
                <p className="text-sm text-muted-foreground">
                  Get rewards points and track your orders easily. Plus, earn Ghost Coins with every purchase!
                </p>
                <Button asChild className="w-full">
                  <Link href="/signup">Register Now</Link>
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-background text-muted-foreground">or</span>
                </div>
              </div>

              {/* Guest Checkout Option */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold">Continue as Guest</h3>
                <p className="text-sm text-muted-foreground">
                  Complete your purchase without creating an account
                </p>
                <GuestCheckoutForm 
                  onSubmit={handleGuestCheckout}
                  isLoading={isPlacingOrder}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

    

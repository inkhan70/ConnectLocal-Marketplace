import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import { calculateDeliveryFee, generatePickupCode, PAYMENT_METHODS, type DeliveryMethod, type PaymentMethod } from '@/lib/order-domain';
import { notifyOrderParties } from '@/lib/server/notifications';
import crypto from 'crypto';

function money(value: number) { return Math.round(value * 100) / 100; }

function authError(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function POST(request: NextRequest) {
  try {
    const db = getAdminDb();
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const deliveryMethod = body.deliveryMethod === 'pickup' ? 'pickup' : 'seller_delivery' as DeliveryMethod;
    const paymentMethod = body.paymentMethod as PaymentMethod;

    if (!items.length) return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
    if (!PAYMENT_METHODS.includes(paymentMethod)) return NextResponse.json({ error: 'Unsupported payment method.' }, { status: 400 });
    if (deliveryMethod === 'seller_delivery' && !body.deliveryAddress?.address) {
      return NextResponse.json({ error: 'A delivery address is required.' }, { status: 400 });
    }

    let decoded: { uid: string; email?: string | null } | null = null;
    try { decoded = await verifyBearerToken(request); } catch {
      // Guest checkout is intentionally supported by the server only.
    }

    const guestEmail = String(body.guest?.email || '').trim();
    const guestName = String(body.guest?.name || '').trim();
    if (!decoded && (!guestEmail || !guestName)) return authError('Sign in or provide guest checkout name and email.');
    if (!decoded && paymentMethod !== 'cod') return authError('Guest online payments require a signed-in account so the payment can be securely linked to the order.');

    const cleanItems = items.map((item: any) => ({
      productId: String(item.productId || ''),
      varietyId: String(item.varietyId || ''),
      quantity: Math.max(0, Math.floor(Number(item.quantity))),
    })).filter((item: any) => item.productId && item.varietyId && item.quantity > 0);
    if (!cleanItems.length) return NextResponse.json({ error: 'No valid items were supplied.' }, { status: 400 });

    const productRefs = Array.from(
      new Map<string, FirebaseFirestore.DocumentReference>(
        cleanItems.map((item: any): [string, FirebaseFirestore.DocumentReference] => [item.productId, db.collection('products').doc(item.productId)])
      ).values()
    );
    const productDocs = await db.getAll(...productRefs);
    const products = new Map(productDocs.filter(d => d.exists).map(d => [d.id, d.data()!]));
    if (products.size !== productRefs.length) return NextResponse.json({ error: 'One or more products no longer exist.' }, { status: 409 });

    const businesses = new Set<string>();
    let subtotal = 0;
    const orderItems: any[] = [];
    const requiredByProduct = new Map<string, number>();

    for (const item of cleanItems) {
      const product: any = products.get(item.productId);
      if (!product?.userId) return NextResponse.json({ error: `Product ${item.productId} has no valid seller.` }, { status: 409 });
      businesses.add(product.userId);
      const variety = Array.isArray(product.varieties) ? product.varieties.find((v: any) => v.id === item.varietyId) : null;
      if (!variety) return NextResponse.json({ error: `A selected product variety is no longer available.` }, { status: 409 });
      if (product.status === 'Archived' || product.status === 'Out of Stock') return NextResponse.json({ error: `${product.name} is not currently available.` }, { status: 409 });
      requiredByProduct.set(item.productId, (requiredByProduct.get(item.productId) || 0) + item.quantity);
      subtotal += Number(variety.price || 0) * item.quantity;
      orderItems.push({ productId: item.productId, productName: product.name, varietyId: item.varietyId, varietyName: variety.name, quantity: item.quantity, price: Number(variety.price || 0), image: variety.image || '' });
    }

    if (businesses.size !== 1) return NextResponse.json({ error: 'For transaction safety, checkout currently supports one seller per order. Remove items from other sellers and try again.' }, { status: 400 });
    const businessId = [...businesses][0];
    const sellerSnap = await db.collection('users').doc(businessId).get();
    if (!sellerSnap.exists) return NextResponse.json({ error: 'Seller account could not be found.' }, { status: 409 });
    const seller: any = sellerSnap.data();
    const ghostCoinOffer = {
      enabled: seller.ghostCoinOfferEnabled === true,
      coinsPerSale: Math.max(0, Math.floor(Number(seller.ghostCoinRewardPerSale || 0))),
      minimumQuantity: Math.max(1, Math.floor(Number(seller.ghostCoinMinimumQuantity || 1))),
    };
    if (decoded && decoded.uid === businessId) return NextResponse.json({ error: 'You cannot purchase from your own business.' }, { status: 400 });
    if (deliveryMethod === 'pickup' && seller.pickupEnabled === false) return NextResponse.json({ error: 'This seller does not offer customer pickup.' }, { status: 400 });
    if (deliveryMethod === 'seller_delivery' && seller.deliveryEnabled === false) return NextResponse.json({ error: 'This seller does not offer delivery.' }, { status: 400 });
    const delivery = calculateDeliveryFee({ method: deliveryMethod, subtotal, seller, buyer: body.destination });
    const total = money(subtotal + delivery.fee);

    const orderId = crypto.randomUUID();
    const pickupCode = generatePickupCode();
    const buyerId = decoded?.uid || `guest_${crypto.randomUUID()}`;
    const paymentStatus = paymentMethod === 'cod' ? 'cod_pending' : 'pending';
    const initialStatus = paymentMethod === 'cod' ? 'paid' : 'pending_payment';

    await db.runTransaction(async transaction => {
      const refs = [...requiredByProduct.keys()].map(id => db.collection('products').doc(id));
      const snapshots: DocumentSnapshot[] = [];
      for (const ref of refs) snapshots.push(await transaction.get(ref));
      snapshots.forEach((snap, index) => {
        if (!snap.exists) throw new Error('A product disappeared during checkout.');
        const data: any = snap.data();
        const needed = requiredByProduct.get(refs[index].id) || 0;
        const current = Number(data.inventory || 0);
        if (current < needed) throw new Error(`${data.name || 'A product'} does not have enough stock.`);
      });
      snapshots.forEach((snap, index) => {
        const ref = refs[index];
        const data: any = snap.data();
        const needed = requiredByProduct.get(ref.id) || 0;
        const next = Math.max(0, Number(data.inventory || 0) - needed);
        transaction.update(ref, { inventory: next, status: next === 0 ? 'Out of Stock' : next <= Number(data.lowStockThreshold || 0) ? 'Low Stock' : 'Active', updatedAt: FieldValue.serverTimestamp() });
      });

      const orderRef = db.collection('orders').doc(orderId);
      transaction.create(orderRef, {
        id: orderId,
        buyerId,
        buyerName: decoded ? String(body.buyerName || decoded.email || 'Buyer') : guestName,
        buyerEmail: decoded?.email || guestEmail,
        buyerPhone: String(body.guest?.phone || body.buyerPhone || ''),
        businessId,
        items: orderItems,
        subtotal: money(subtotal),
        deliveryFee: delivery.fee,
        deliveryDistanceKm: delivery.distanceKm,
        deliveryFeeEstimated: delivery.estimated,
        deliveryMethod,
        deliveryAddress: body.deliveryAddress || null,
        destination: body.destination || null,
        totalCost: total,
        currency: String(seller.currencyCode || process.env.MARKETPLACE_CURRENCY || process.env.NEXT_PUBLIC_MARKETPLACE_CURRENCY || 'USD').toUpperCase(),
        ghostCoinOffer,
        orderDate: FieldValue.serverTimestamp(),
        status: initialStatus,
        paymentMethod,
        paymentStatus,
        pickupCode,
        pickupVerified: false,
        isGuestOrder: !decoded,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        audit: [{ action: 'order_created', actorId: buyerId, at: new Date().toISOString() }],
      });
    });

    const createdOrder = { id: orderId, buyerId, businessId, status: initialStatus };
    await notifyOrderParties(createdOrder, { title: 'New order', body: `Order ${orderId} has been created.`, type: 'order_created' });
    return NextResponse.json({ success: true, orderId, pickupCode, status: initialStatus, paymentStatus, subtotal: money(subtotal), deliveryFee: delivery.fee, totalCost: total, paymentRequired: paymentMethod !== 'cod', ghostCoinOffer });
  } catch (error: any) {
    console.error('Order creation failed:', error);
    const message = error?.message || 'Could not create order.';
    return NextResponse.json({ error: message }, { status: message.includes('not configured') ? 503 : 500 });
  }
}

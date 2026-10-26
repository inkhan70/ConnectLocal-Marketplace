import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyBearerToken, authErrorStatus } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const type = new URL(request.url).searchParams.get('type');
    if (type !== 'orders' && type !== 'chats') {
      return NextResponse.json({ error: 'type must be orders or chats' }, { status: 400 });
    }

    const db = getAdminDb();
    const batch = db.batch();
    let count = 0;

    if (type === 'orders') {
      const [buyerOrders, sellerOrders] = await Promise.all([
        db.collection('orders').where('buyerId', '==', decoded.uid).get(),
        db.collection('orders').where('businessId', '==', decoded.uid).get(),
      ]);
      const unique = new Map([...buyerOrders.docs, ...sellerOrders.docs].map((doc) => [doc.id, doc]));
      unique.forEach((doc) => { batch.delete(doc.ref); count += 1; });
    } else {
      const chats = await db.collection('chats').where('participants', 'array-contains', decoded.uid).get();
      for (const chat of chats.docs) {
        const messages = await chat.ref.collection('messages').get();
        messages.docs.forEach((message) => { batch.delete(message.ref); count += 1; });
        batch.delete(chat.ref);
        count += 1;
      }
    }

    if (count > 0) await batch.commit();
    return NextResponse.json({ success: true, deleted: count });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not clear history.' }, { status: authErrorStatus(error) });
  }
}

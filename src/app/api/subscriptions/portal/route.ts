import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, verifyBearerToken, getAdminDb, safeMessage } from '@/lib/server/firebase-admin';

import { getAppUrl } from '@/lib/server/app-url';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get();
    const user = userSnap.data() || {};
    const customer = user.stripeCustomerId;
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return NextResponse.json({ success: false, error: 'Stripe billing is not configured.' }, { status: 503 });
    if (!customer) return NextResponse.json({ success: false, error: 'No Stripe billing profile is linked to this account yet.' }, { status: 409 });
    const appUrl = getAppUrl(request);
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ customer: String(customer), return_url: `${appUrl}/dashboard/subscription` }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ success: false, error: (data?.error?.message || 'Could not open billing portal.') }, { status: 502 });
    return NextResponse.json({ success: true, url: data.url });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: safeMessage(error, 'Billing portal failed.') }, { status: authErrorStatus(error) });
  }
}

export type PaymentMethod = 'cod' | 'jazzcash' | 'easypaisa' | 'stripe' | 'paypal';

export interface PaymentConfig { method: PaymentMethod; orderId: string; }
export interface PaymentResponse { success: boolean; provider: PaymentMethod | null; status?: string; clientSecret?: string; paymentOrderId?: string; checkoutUrl?: string; links?: Array<{ href: string; rel?: string; method?: string }>; error?: string; }

export async function processPayment(config: PaymentConfig, idToken: string): Promise<PaymentResponse> {
  try {
    const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ orderId: config.orderId }) });
    const data = await response.json();
    if (!response.ok) return { success: false, provider: config.method, error: data.error || 'Payment processing failed.' };
    return { success: true, provider: data.provider || config.method, status: data.status, clientSecret: data.clientSecret, paymentOrderId: data.orderId, checkoutUrl: data.checkoutUrl, links: data.links };
  } catch (error: any) {
    return { success: false, provider: config.method, error: error?.message || 'Payment processing failed.' };
  }
}

export function formatAmount(amount: number, currency = process.env.NEXT_PUBLIC_MARKETPLACE_CURRENCY || 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function isValidPaymentMethod(method: unknown): method is PaymentMethod {
  return ['cod', 'jazzcash', 'easypaisa', 'stripe', 'paypal'].includes(String(method));
}

export function getPaymentMethodName(method: PaymentMethod) {
  return ({ cod: 'Cash on Delivery', jazzcash: 'JazzCash', easypaisa: 'Easypaisa', stripe: 'Stripe', paypal: 'PayPal' } as const)[method];
}

/**
 * Payment Processing Utilities
 * Handles payment method routing and processing
 */

export type PaymentMethod = 'credit_debit' | 'upi' | 'bank_transfer' | 'cod';

export interface PaymentConfig {
  method: PaymentMethod;
  amount: number;
  email: string;
  orderId: string;
  customerName: string;
}

export interface PaymentResponse {
  success: boolean;
  provider: 'stripe' | 'razorpay' | 'cod' | null;
  clientSecret?: string;
  paymentIntentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  message?: string;
  error?: string;
}

/**
 * Process payment based on selected method
 */
export async function processPayment(config: PaymentConfig): Promise<PaymentResponse> {
  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: config.amount,
        email: config.email,
        paymentMethod: config.method,
        orderId: config.orderId,
        customerName: config.customerName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Payment processing failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      provider: null,
      error: error.message || 'Payment processing failed',
    };
  }
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Validate payment method
 */
export function isValidPaymentMethod(method: any): method is PaymentMethod {
  return ['credit_debit', 'upi', 'bank_transfer', 'cod'].includes(method);
}

/**
 * Get payment method display name
 */
export function getPaymentMethodName(method: PaymentMethod): string {
  const names: Record<PaymentMethod, string> = {
    credit_debit: 'Credit/Debit Card',
    upi: 'UPI Payment',
    bank_transfer: 'Bank Transfer',
    cod: 'Cash on Delivery',
  };
  return names[method];
}

/**
 * Get payment provider for method
 */
export function getPaymentProvider(method: PaymentMethod): string {
  switch (method) {
    case 'credit_debit':
      return 'stripe';
    case 'upi':
    case 'bank_transfer':
      return 'razorpay';
    case 'cod':
      return 'direct';
    default:
      return 'unknown';
  }
}

/**
 * Calculate total with fees if applicable
 */
export function calculatePaymentTotal(subtotal: number, shippingCost: number = 5, paymentMethod: PaymentMethod): {
  subtotal: number;
  shipping: number;
  processingFee: number;
  total: number;
} {
  let processingFee = 0;

  // Add processing fees based on payment method
  switch (paymentMethod) {
    case 'credit_debit':
      processingFee = subtotal * 0.025; // 2.5% for card payments
      break;
    case 'upi':
      processingFee = 0; // Usually free for UPI
      break;
    case 'bank_transfer':
      processingFee = 0;
      break;
    case 'cod':
      processingFee = subtotal * 0.02; // 2% for COD handling
      break;
  }

  return {
    subtotal,
    shipping: shippingCost,
    processingFee: Math.round(processingFee * 100) / 100,
    total: Math.round((subtotal + shippingCost + processingFee) * 100) / 100,
  };
}

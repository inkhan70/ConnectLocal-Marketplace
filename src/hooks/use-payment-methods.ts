"use client";

import { useEffect, useState } from "react";

export interface PaymentMethodOption { value: "cod" | "stripe" | "paypal"; label: string; description?: string }

const FALLBACK: PaymentMethodOption[] = [{ value: "cod", label: "Cash on Delivery" }];
let cached: { at: number; methods: PaymentMethodOption[] } | null = null;

/** The payment methods this deployment can really process (server-decided; Cash on Delivery is always present). */
export function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethodOption[]>(cached?.methods ?? FALLBACK);
  const [isLoading, setIsLoading] = useState(!cached);

  useEffect(() => {
    if (cached && Date.now() - cached.at < 60_000) { setMethods(cached.methods); setIsLoading(false); return; }
    let cancelled = false;
    fetch("/api/payments/methods", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body) => {
        const list: PaymentMethodOption[] = Array.isArray(body?.methods) && body.methods.length ? body.methods : FALLBACK;
        cached = { at: Date.now(), methods: list };
        if (!cancelled) setMethods(list);
      })
      .catch(() => { if (!cancelled) setMethods(FALLBACK); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { methods, isLoading };
}

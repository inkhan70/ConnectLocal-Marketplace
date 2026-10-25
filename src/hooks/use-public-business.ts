"use client";

import { useEffect, useState } from "react";
import type { UserProfile } from "@/contexts/AuthContext";

/** Public (allow-listed) view of a business. Private fields such as email or balance are never included. */
export type PublicBusiness = Partial<UserProfile> & { uid: string };

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function getJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  let pending = inflight.get(url) as Promise<T> | undefined;
  if (!pending) {
    pending = fetch(url, { method: "GET", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error: any = new Error(body?.error || `Request failed (${response.status})`);
          error.status = response.status;
          throw error;
        }
        cache.set(url, { at: Date.now(), value: body });
        return body as T;
      })
      .finally(() => inflight.delete(url));
    inflight.set(url, pending);
  }
  return pending;
}

/** Fetches the public business directory for the given roles. Same `{ data, isLoading }` shape as useCollection. */
export function usePublicBusinesses(roles: string[]) {
  const key = roles.join(",");
  // Typed as UserProfile for the existing screens; private fields are simply absent at runtime.
  const [data, setData] = useState<UserProfile[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getJson<{ businesses: PublicBusiness[] }>(`/api/public/businesses?roles=${encodeURIComponent(key)}`)
      .then((body) => { if (!cancelled) { setData((body.businesses || []) as UserProfile[]); setError(null); } })
      .catch((e) => { if (!cancelled) { setError(e); setData([]); } })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  return { data, isLoading, error };
}

/** Fetches one business' public profile. `data` is null when it does not exist (404). */
export function usePublicBusiness(id: string | null | undefined) {
  const [data, setData] = useState<PublicBusiness | null>(null);
  const [isLoading, setIsLoading] = useState(!!id);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) { setData(null); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    getJson<{ business: PublicBusiness }>(`/api/public/businesses/${encodeURIComponent(id)}`)
      .then((body) => { if (!cancelled) { setData(body.business); setError(null); } })
      .catch((e) => { if (!cancelled) { setData(null); setError(e.status === 404 ? null : e); } })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  return { data, isLoading, error };
}

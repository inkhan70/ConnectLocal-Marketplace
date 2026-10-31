"use client";

import { useEffect, useState } from "react";
import type { CategoryItem } from "@/lib/category-management";

const TTL_MS = 60_000;
let cached: { at: number; list: CategoryItem[] } | null = null;
let inflight: Promise<CategoryItem[]> | null = null;

async function loadLiveCategories(): Promise<CategoryItem[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.list;
  if (!inflight) {
    inflight = fetch("/api/categories", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(body.list)) throw new Error(body?.error || "Could not load categories.");
        cached = { at: Date.now(), list: body.list as CategoryItem[] };
        return cached.list;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** The live admin category list (same one the guest category pages use). */
export function useLiveCategories() {
  const [list, setList] = useState<CategoryItem[]>(cached?.list || []);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLiveCategories()
      .then((value) => { if (!cancelled) { setList(value); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { list, isLoading, error };
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, where } from "firebase/firestore";
import { Loader2, MapPin, Package, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import type { UserProfile } from "@/contexts/AuthContext";
import {
  cacheLocation,
  calculateDistance,
  getCachedLocation,
  getUserLocation,
} from "@/lib/geolocation";
import type { LocationData } from "@/lib/geolocation";

type Product = {
  id?: string;
  name?: string;
  description?: string;
  userId?: string;
  varieties?: Array<{ price?: number }>;
};

type SearchResult =
  | { type: "product"; data: Product }
  | { type: "business"; data: UserProfile & { distance?: number } };

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const searchTerm = searchParams.get("q")?.trim() || "";
  const city = searchParams.get("city")?.trim() || "";
  const maxDistance = Number(searchParams.get("maxDistance")) || 100;
  const minPrice = Number(searchParams.get("minPrice"));
  const maxPrice = Number(searchParams.get("maxPrice"));
  const firestore = useFirestore();
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);

  const productsQuery = useMemoFirebase(() => {
    if (!searchTerm) return null;
    return query(
      collection(firestore, "products"),
      where("name", ">=", searchTerm),
      where("name", "<=", `${searchTerm}\uf8ff`),
    );
  }, [firestore, searchTerm]);

  const businessesQuery = useMemoFirebase(() => {
    if (!user) return null;
    const roles = ["company", "wholesaler", "distributor", "shopkeeper"];
    const filters = [where("role", "in", roles)];
    if (searchTerm) {
      filters.push(where("businessName", ">=", searchTerm));
      filters.push(where("businessName", "<=", `${searchTerm}\uf8ff`));
    }
    if (city) filters.push(where("city", "==", city));
    return query(collection(firestore, "users"), ...filters);
  }, [firestore, searchTerm, city, user]);

  const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);
  const { data: businesses, isLoading: businessesLoading } = useCollection<UserProfile>(businessesQuery);

  useEffect(() => {
    const cached = getCachedLocation(30);
    if (cached) {
      setUserLocation(cached);
      return;
    }
    getUserLocation().then((location) => {
      if (location) {
        cacheLocation(location);
        setUserLocation(location);
      }
    });
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const productResults = (products || []).filter((product) => {
      const prices = product.varieties?.map((item) => Number(item.price)).filter(Number.isFinite) || [];
      const price = prices.length ? Math.min(...prices) : null;
      return (Number.isNaN(minPrice) || (price !== null && price >= minPrice)) &&
        (Number.isNaN(maxPrice) || (price !== null && price <= maxPrice));
    }).map((data) => ({ type: "product" as const, data }));

    const businessResults = (businesses || []).map((business) => {
      if (!userLocation) return { type: "business" as const, data: business };
      const { latitude, longitude } = userLocation.coordinates;
      const distance = calculateDistance(latitude, longitude, business.latitude || 0, business.longitude || 0);
      return { type: "business" as const, data: { ...business, distance } };
    }).filter((result) => !("distance" in result.data) || result.data.distance <= maxDistance);

    return [...productResults, ...businessResults];
  }, [products, businesses, userLocation, minPrice, maxPrice, maxDistance]);

  if (productsLoading || businessesLoading) {
    return <div className="flex min-h-64 items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin" /><span>Searching...</span></div>;
  }

  const title = searchTerm && city ? `"${searchTerm}" in ${city}` : searchTerm ? `"${searchTerm}"` : city ? `Businesses in ${city}` : "All Results";

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6"><h1 className="text-3xl font-bold">{title}</h1><p className="mt-1 text-muted-foreground">{results.length} result{results.length === 1 ? "" : "s"} found</p></div>
      {results.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">No results found. Try a different search.</CardContent></Card> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.map((result, index) => {
          if (result.type === "product") return <Card key={`product-${result.data.id || index}`}><CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />{result.data.name || "Unnamed product"}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{result.data.description || "Product available from a local business."}</p></CardContent></Card>;
          return <Card key={`business-${result.data.uid || index}`}><CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />{result.data.businessName || result.data.fullName || "Business"}</CardTitle></CardHeader><CardContent className="space-y-2"><Badge variant="secondary">{result.data.role}</Badge><p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{[result.data.city, result.data.state].filter(Boolean).join(", ") || "Location unavailable"}</p>{result.data.distance !== undefined && <p className="text-sm text-muted-foreground">{result.data.distance.toFixed(1)} km away</p>}</CardContent></Card>;
        })}</div>}
    </main>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}><SearchResultsContent /></Suspense>;
}

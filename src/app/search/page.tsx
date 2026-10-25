"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, limit, query } from "firebase/firestore";
import { Loader2, MapPin, Package, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import type { UserProfile } from "@/contexts/AuthContext";
import { usePublicBusinesses } from "@/hooks/use-public-business";
import {
  cacheLocation,
  calculateDistance,
  getCachedLocation,
  getUserLocation,
  isValidCoordinate,
} from "@/lib/geolocation";
import type { LocationData } from "@/lib/geolocation";

type Product = {
  id?: string;
  name?: string;
  description?: string;
  userId?: string;
  category?: string;
  businessName?: string;
  varieties?: Array<{ price?: number }>;
};

type SearchResult =
  | { type: "product"; data: Product }
  | { type: "business"; data: UserProfile & { distance?: number } };

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get("q")?.trim() || "";
  const city = searchParams.get("city")?.trim() || "";
  const maxDistance = Number(searchParams.get("maxDistance")) || 100;
  const minPrice = Number(searchParams.get("minPrice"));
  const maxPrice = Number(searchParams.get("maxPrice"));
  const firestore = useFirestore();
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);

  // Do not use case-sensitive range queries here. They miss existing members
  // when the guest types a different case, searches a category, or searches a
  // service role. Load the public catalog and normalize matching client-side.
  // Products are public listings. The query is capped so a visitor can never trigger an unbounded read.
  const productsQuery = useMemoFirebase(() => query(collection(firestore, "products"), limit(500)), [firestore]);

  const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);
  // Business members come from the server's public directory (allow-listed fields only, buyers/admins excluded).
  const { data: businesses, isLoading: businessesLoading } = usePublicBusinesses(["company", "wholesaler", "distributor", "shopkeeper", "services"]);

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
    const normalizedTerm = searchTerm.toLocaleLowerCase();
    const productResults = (products || []).filter((product) => {
      const searchable = [product.name, product.description, product.category, product.businessName]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      if (normalizedTerm && !searchable.includes(normalizedTerm)) return false;
      const prices = product.varieties?.map((item) => Number(item.price)).filter(Number.isFinite) || [];
      const price = prices.length ? Math.min(...prices) : null;
      return (Number.isNaN(minPrice) || (price !== null && price >= minPrice)) &&
        (Number.isNaN(maxPrice) || (price !== null && price <= maxPrice));
    }).map((data) => ({ type: "product" as const, data }));

    const businessResults = (businesses || []).filter((business) => {
      const searchable = [business.businessName, business.fullName, business.category, business.subcategoryId, business.subcategoryName, business.city, business.state]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      return (!normalizedTerm || searchable.includes(normalizedTerm)) &&
        (!city || String(business.city || "").toLocaleLowerCase() === city.toLocaleLowerCase());
    }).map((business) => {
      if (!userLocation) return { type: "business" as const, data: business };
      const { latitude, longitude } = userLocation.coordinates;
      // Missing coordinates must not be treated as (0, 0), which can produce
      // false distances and hide otherwise valid search results (Number(null) === 0!).
      if (!isValidCoordinate(business.latitude, business.longitude)) {
        return { type: "business" as const, data: business };
      }
      const businessLat = Number(business.latitude);
      const businessLon = Number(business.longitude);
      const distance = calculateDistance(latitude, longitude, businessLat, businessLon);
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

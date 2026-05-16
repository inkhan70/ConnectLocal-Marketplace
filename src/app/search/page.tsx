"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowRight, Loader2, Store, Heart, Package, SearchX, Navigation } from "lucide-react";
import { useLanguage } from '@/contexts/LanguageContext';
import images from '@/app/lib/placeholder-images.json';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/contexts/AuthContext';
import { collection, query, where } from 'firebase/firestore';
import { Badge } from "@/components/ui/badge";
import { calculateDistance, getUserLocation, getCachedLocation, cacheLocation, formatDistance } from "@/lib/geolocation";
import type { LocationData } from "@/lib/geolocation";

// Combine Product and Business into a single result type
type SearchResult = 
    | { type: 'product'; data: Product }
    | { type: 'business'; data: UserProfile };

interface Variety {
    id: string;
    name: string;
    price: number;
    image?: string;
    dataAiHint?: string;
}

interface Product {
    id: string;
    name: string;
    status: "Active" | "Archived" | "Low Stock" | "Out of Stock";
    inventory: number;
    category?: string;
    userId?: string;
    varieties: Variety[];
}


function SearchResultsContent() {
    const searchParams = useSearchParams();
    const { t } = useLanguage();
    const searchTerm = searchParams.get('q') || '';
    const city = searchParams.get('city') || '';
    const maxDistanceParam = searchParams.get('maxDistance') || '100';
    const minPriceParam = searchParams.get('minPrice');
    const maxPriceParam = searchParams.get('maxPrice');
    const firestore = useFirestore();
    const [userLocation, setUserLocation] = useState<LocationData | null>(null);
    
    const productsQuery = useMemoFirebase(() => {
        if (!searchTerm) return null;
        return query(collection(firestore, 'products'), 
            where('name', '>=', searchTerm),
            where('name', '<=', searchTerm + '\uf8ff')
        );
    }, [firestore, searchTerm]);
    
    const businessesQuery = useMemoFirebase(() => {
        const businessRoles = ["company", "wholesaler", "distributor", "shopkeeper"];
        const usersCollection = collection(firestore, 'users');
        let q = query(usersCollection, where('role', 'in', businessRoles));

        const nameFilter = searchTerm ? [where('businessName', '>=', searchTerm), where('businessName', '<=', searchTerm + '\uf8ff')] : [];
        const cityFilter = city ? [where('city', '==', city)] : [];
        
        const allFilters = [...nameFilter, ...cityFilter];

        if (allFilters.length === 0) return null; 
        
        return query(q, ...allFilters);

    }, [firestore, searchTerm, city]);

    const { data: productResults, isLoading: productsLoading } = useCollection<Product>(productsQuery);
    const { data: businessResults, isLoading: businessesLoading } = useCollection<UserProfile>(businessesQuery);
    
    const [combinedResults, setCombinedResults] = useState<SearchResult[]>([]);
    
    // Load user location
    useEffect(() => {
        const loadLocation = async () => {
            const cached = getCachedLocation(30);
            if (cached) {
                setUserLocation(cached);
                return;
            }
            const location = await getUserLocation();
            if (location) {
                cacheLocation(location);
                setUserLocation(location);
            }
        };
        loadLocation();
    }, []);
    
    useEffect(() => {
        const results: SearchResult[] = [];
        const maxDistance = parseInt(maxDistanceParam) || 100;
        const minPrice = minPriceParam ? parseFloat(minPriceParam) : null;
        const maxPrice = maxPriceParam ? parseFloat(maxPriceParam) : null;
        
        if (productResults && !city) { 
            let filtered = productResults;
            
            // Filter by price if specified
            if (minPrice !== null || maxPrice !== null) {
                filtered = filtered.filter(p => {
                    const minVarietyPrice = Math.min(...(p.varieties?.map(v => v.price) || [Infinity]));
                    if (minPrice !== null && minVarietyPrice < minPrice) return false;
                    if (maxPrice !== null && minVarietyPrice > maxPrice) return false;
                    return true;
                });
            }
            
            results.push(...filtered.map(p => ({ type: 'product' as const, data: p })));
        }
        
        if (businessResults) {
            let filtered = businessResults;
            
            // Filter by distance if location is available
            if (userLocation) {
                const { latitude, longitude } = userLocation.coordinates;
                filtered = filtered.map(b => ({
                    ...b,
                    distance: calculateDistance(
                        latitude,
                        longitude,
                        b.latitude || 0,
                        b.longitude || 0
                    )
                })).filter(b => b.distance <= maxDistance);
            }
            
            results.push(...filtered.map(b => ({ type: 'business' as const, data: b })));
        }
        
        setCombinedResults(results);
    }, [productResults, businessResults, city, userLocation, maxDistanceParam, minPriceParam, maxPriceParam]);
    
    const isLoading = productsLoading || businessesLoading;

    const getTitle = () => {
        if (searchTerm && city) return `"${searchTerm}" in ${city}`;
        if (searchTerm) return `"${searchTerm}"`;
        if (city) return `Businesses in ${city}`;
        return "All Results";
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-4">Searching...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="text-left mb-8">
                <p className="text-lg text-muted-foreground">Search results for</p>
                <h1 className="text-4xl md:text-5xl font-extrabold font-headline leading-tight tracking-tighter">
                  {getTitle()}
                </h1>
            </div>
            
            {combinedResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {combinedResults.map((result) => {
                       if (result.type === 'product') {
                           const product = result.data;
                           return (
                             <Card key={`prod-${product.id}`} className="flex flex-col">
                               <CardHeader className="p-0">
                                   <Image
                                       alt={product.name}
                                       className="aspect-video w-full rounded-t-lg object-cover"
                                       height="180"
                                       src={product.varieties?.[0]?.image || images.search.result}
                                       width={320}
                                       data-ai-hint={product.varieties?.[0]?.dataAiHint || "product image"}
                                   />
                               </CardHeader>
                               <CardContent className="p-4 flex-grow">
                                    <Badge variant="secondary" className="mb-2"><Package className="mr-1 h-3 w-3" />Product</Badge>
                                    <CardTitle className="font-headline text-xl">{product.name}</CardTitle>
                                    <CardDescription>{product.category}</CardDescription>
                               </CardContent>
                               <CardFooter className="p-4 pt-0">
                                   <Button asChild className="w-full">
                                       <Link href={`/products/item/${product.id}`}>
                                           View Product
                                       </Link>
                                   </Button>
                               </CardFooter>
                           </Card>
                           );
                       }
                       if (result.type === 'business') {
                           const business = result.data as UserProfile & { distance?: number };
                           return (
                             <Card key={`biz-${business.uid}`} className="flex flex-col">
                                <CardHeader className="p-0">
                                    <Image
                                        alt={business.businessName}
                                        className="aspect-video w-full rounded-t-lg object-cover"
                                        height="180"
                                        src={images.businesses.corner_store}
                                        width={320}
                                        data-ai-hint={"corner store"}
                                    />
                                </CardHeader>
                               <CardContent className="p-4 flex-grow">
                                   <div className="flex items-center justify-between mb-2">
                                       <Badge variant="outline"><Store className="mr-1 h-3 w-3"/>Business</Badge>
                                       {business.distance !== undefined && (
                                           <Badge variant="secondary" className="text-xs">
                                               <Navigation className="mr-1 h-3 w-3" />
                                               {formatDistance(business.distance)}
                                           </Badge>
                                       )}
                                   </div>
                                   <CardTitle className="font-headline text-xl">{business.businessName}</CardTitle>
                                   <CardDescription className="flex items-start gap-1">
                                       <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                       <span>{business.address}</span>
                                   </CardDescription>
                                   {business.subcategoryName && (
                                       <p className="text-sm text-primary mt-2 font-medium">{business.subcategoryName}</p>
                                   )}
                               </CardContent>
                               <CardFooter className="p-4 pt-0">
                                   <Button asChild className="w-full">
                                       <Link href={`/products/distributor/${business.uid}`}>
                                           Visit Storefront
                                       </Link>
                                   </Button>
                               </CardFooter>
                           </Card>
                           );
                       }
                       return null;
                    })}
                </div>
            ) : (
                <div className="text-center py-16 bg-muted/50 rounded-lg">
                    <SearchX className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mt-4">No Results Found</h3>
                    <p className="text-muted-foreground mt-2">Your search did not match any products or businesses.</p>
                     <Button asChild variant="secondary" className="mt-6">
                        <Link href="/">
                            Back to Home
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}


export default function SearchPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <SearchResultsContent />
        </Suspense>
    );
}

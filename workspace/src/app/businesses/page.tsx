
"use client"

import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { MapPin, ArrowRight, Loader2, Store, Heart } from "lucide-react";
import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProductSearch } from "@/components/ProductSearch";
import images from '@/app/lib/placeholder-images.json';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import type { UserProfile } from "@/contexts/AuthContext";
import { collection, query, where, QueryConstraint } from "firebase/firestore";
import { useFavorites, FavoriteBusiness } from "@/contexts/FavoritesContext";
import { cn } from "@/lib/utils";

// --- Helper Functions ---
// Haversine formula to calculate distance between two lat/lon points
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d; // Distance in km
};

const PROXIMITY_RADIUS_KM = 100;

interface Business extends UserProfile {
    distance?: number;
    // Assuming user profiles used as businesses have lat/lon stored somehow
    lat?: number;
    lon?: number;
    image?: string;
    dataAiHint?: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);


function BusinessesContent() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const firestore = useFirestore();
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  
  const categoryParam = searchParams.get('category') || 'all';
  const roleParam = searchParams.get('role') || 'shopkeeper';
  
  // FIX: Convert URL role parameter (plural) to the singular form stored in Firestore.
  const role = roleParam.endsWith('s') ? roleParam.slice(0, -1) : roleParam;
  const category = categoryParam === 'all' ? 'all' : capitalize(categoryParam);

  const [displayedBusinesses, setDisplayedBusinesses] = useState<Business[]>([]);
  const [userCoords, setUserCoords] = useState<{lat: number, lon: number} | null>(null);

  const businessesQuery = useMemoFirebase(() => {
    const usersCollection = collection(firestore, 'users');
    const constraints: QueryConstraint[] = [];

    // Always filter by role
    constraints.push(where('role', '==', role));

    // Add category filter if it's not 'all'
    if (category !== 'all') {
      constraints.push(where('category', '==', category));
    }
    
    // The query requires a composite index on `role` and `category`. 
    // Firestore will provide a link in the console error to create it automatically.
    return query(usersCollection, ...constraints);
  }, [firestore, role, category]);

  const { data: fetchedBusinesses, isLoading: loading, error } = useCollection<UserProfile>(businessesQuery);

  useEffect(() => {
    // Get user's location once
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
        },
        (error) => {
          console.warn("Geolocation denied or unavailable.", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (fetchedBusinesses) {
      let allBusinessesWithData: Business[] = fetchedBusinesses.map((biz) => ({
        ...biz,
        id: biz.uid,
        lat: 34.0522 + (Math.random() - 0.5) * 2, // Fake lat around LA
        lon: -118.2437 + (Math.random() - 0.5) * 2, // Fake lon around LA
        image: images.businesses.corner_store, // Placeholder image
        dataAiHint: 'corner store'
      }));

      if (userCoords) {
        // Calculate distance for all businesses
        const businessesWithDistance = allBusinessesWithData.map(biz => ({
          ...biz,
          distance: getDistance(userCoords.lat, userCoords.lon, biz.lat!, biz.lon!),
        }));

        // Filter for businesses within the radius
        const nearbyBusinesses = businessesWithDistance.filter(biz => biz.distance! <= PROXIMITY_RADIUS_KM);
        
        if (nearbyBusinesses.length > 0) {
          // If there are nearby businesses, show them sorted by distance
          setDisplayedBusinesses(nearbyBusinesses.sort((a, b) => a.distance! - b.distance!));
        } else {
          // If no businesses are nearby, show all businesses, still sorted by distance
          setDisplayedBusinesses(businessesWithDistance.sort((a, b) => a.distance! - b.distance!));
        }
      } else {
        // If no user location, just show all fetched businesses
        setDisplayedBusinesses(allBusinessesWithData);
      }
    }
  }, [fetchedBusinesses, userCoords]);


  const roleTitle = t(`roles.${roleParam}`); // Use original plural param for display
  const categoryTitle = category === 'all' ? 'All Businesses' : category;

  if (loading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-4">{t('businesses.loading')}</p>
        </div>
    )
  }

  const renderContent = () => {
    if (displayedBusinesses.length > 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {displayedBusinesses.map((biz) => {
              const favorite = isFavorite(biz.uid);
              return (
              <Card key={biz.uid} className="flex flex-col relative">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 z-10 bg-black/30 hover:bg-black/50 text-white hover:text-white"
                    onClick={(e) => {
                        e.preventDefault();
                        const favData: FavoriteBusiness = {
                            id: biz.uid,
                            name: biz.businessName,
                            address: biz.address,
                            image: biz.image,
                            dataAiHint: biz.dataAiHint,
                        };
                        favorite ? removeFavorite(biz.uid) : addFavorite(favData);
                    }}
                >
                    <Heart className={cn("h-5 w-5", favorite ? "fill-red-500 text-red-500" : "")} />
                </Button>
                <CardHeader className="p-0">
                  <Image src={biz.image || images.businesses.supermarket_aisle} alt={biz.businessName || 'Business'} width={350} height={200} className="rounded-t-lg object-cover w-full h-40" data-ai-hint={biz.dataAiHint || 'business exterior'} />
                </CardHeader>
                 <CardContent className="p-4 flex-grow">
                    <CardTitle className="font-headline text-xl">{biz.businessName}</CardTitle>
                    <CardDescription className="flex items-center pt-1">
                        <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                        {biz.address}
                    </CardDescription>
                    {biz.distance !== undefined && (
                        <p className="text-sm font-semibold text-primary mt-2">
                            {biz.distance.toFixed(1)} km {t('businesses.distance_away')}
                        </p>
                    )}
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button asChild className="w-full">
                    <Link href={`/products/distributor/${biz.uid}`}>
                      {t('businesses.view_products')} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )})}
          </div>
        )
    }
    
     if (displayedBusinesses.length === 0 && !loading) {
         return (
            <div className="text-center py-16 bg-muted/50 rounded-lg">
                <Store className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="text-xl font-semibold mt-4">No Businesses Found</h3>
                <p className="text-muted-foreground mt-2">There are no businesses registered for the selected role and category.</p>
            </div>
        )
    }
    
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <ProductSearch placeholder={t('businesses.search_placeholder')} />
        </div>

      <div className="text-left mb-8">
        <p className="text-lg text-muted-foreground">{t('businesses.showing_role_for')} {roleTitle} for</p>
        <h1 className="text-4xl md:text-5xl font-extrabold font-headline leading-tight tracking-tighter">
          {categoryTitle}
        </h1>
      </div>

       {renderContent()}

      <Pagination className="mt-12">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#">{t('businesses.pagination_previous')}</PaginationPrevious>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">3</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#">{t('businesses.pagination_next')}</PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

export default function BusinessesPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <BusinessesContent />
        </Suspense>
    )
}

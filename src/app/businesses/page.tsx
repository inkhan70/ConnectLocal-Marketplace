
"use client"
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { MapPin, ArrowRight, Loader2, Store, Heart, Navigation, LocateFixed } from "lucide-react";
import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProductSearch } from "@/components/ProductSearch";
import images from '@/app/lib/placeholder-images.json';
import { usePublicBusinesses } from "@/hooks/use-public-business";
import { UserProfile } from "@/contexts/AuthContext";
import { useFavorites, FavoriteBusiness } from "@/contexts/FavoritesContext";
import { cn } from "@/lib/utils";
import { useLiveCategories } from '@/hooks/use-live-categories';
import { businessMatchesCategory, normText, resolveLiveSubcategory, topLevelCategories, categoryKeyFor } from '@/lib/category-live';
import { 
  calculateDistance, 
  isValidCoordinate,
  getBrowserLocation, 
  getCachedLocation, 
  cacheLocation,
  formatDistance,
} from "@/lib/geolocation";
import type { LocationData } from "@/lib/geolocation";

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
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  
  const categoryParam = searchParams.get('category') || 'all';
  const roleParam = searchParams.get('role') || 'shopkeeper';
  const subcategoryParam = searchParams.get('subcategory') || ''; 
  
  // Category/subcategory matching runs against the live admin list (see lib/category-live.ts), the same list the
  // member picked from during onboarding, so the two can no longer drift apart.
  const { list: liveCategories, isLoading: categoriesLoading } = useLiveCategories();
  const category = categoryParam === 'all' ? 'all' : normText(decodeURIComponent(categoryParam)).replace(/ /g, '-');
  const searchQuery = (searchParams.get('q') || '').trim().toLowerCase();

  const [displayedBusinesses, setDisplayedBusinesses] = useState<Business[]>([]);
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationAttempt, setLocationAttempt] = useState(0);

  // Public, allow-listed directory from the server (no private profile fields ever reach the browser).
  // Load the complete public directory before applying category filters. Older accounts can
  // have a valid Food profile with a legacy role/subcategory value, so filtering by the
  // URL's inferred role at the API boundary can hide an otherwise public business.
  const { data: fetchedBusinesses, isLoading: loading, error } = usePublicBusinesses([
    'company', 'wholesaler', 'distributor', 'shopkeeper', 'services',
  ]);

  // Get user location on mount
  useEffect(() => {
    let cancelled = false;
    const loadUserLocation = async () => {
      setIsLoadingLocation(true);
      setLocationMessage(null);
      try {
        const cached = locationAttempt === 0 ? getCachedLocation(30) : null;
        if (cached) {
          if (!cancelled) setUserLocation(cached);
          return;
        }
        const browserLocation = await getBrowserLocation();
        if (cancelled) return;
        if (browserLocation) {
          const location: LocationData = {
            coordinates: browserLocation, source: 'browser', city: '', state: '', country: '', countryCode: '',
          };
          cacheLocation(location);
          setUserLocation(location);
          setLocationMessage(null);
        } else {
          setUserLocation(null);
          setLocationMessage('Location could not be read. Check this site’s browser permission and Android Location settings, then try again.');
        }
      } catch {
        if (!cancelled) setLocationMessage('Location could not be read. You can still browse businesses without distance filtering.');
      } finally {
        if (!cancelled) setIsLoadingLocation(false);
      }
    };
    loadUserLocation();
    return () => { cancelled = true; };
  }, [locationAttempt]);

  useEffect(() => {
    if (!fetchedBusinesses) return;

    const processedBusinesses: Business[] = fetchedBusinesses
      .filter((biz) => businessMatchesCategory(liveCategories, biz as any, { categoryParam, subcategoryParam }))
      .map((biz) => ({
        ...biz,
        id: biz.uid,
        // Never invent coordinates. Missing coordinates must never be turned into
        // a real city coordinate because that creates false proximity results.
        // Coordinates stored as numeric strings are accepted; 0 is a valid value; junk becomes undefined.
        lat: isValidCoordinate(biz.latitude, biz.longitude) ? Number(biz.latitude) : undefined,
        lon: isValidCoordinate(biz.latitude, biz.longitude) ? Number(biz.longitude) : undefined,
        image: biz.storefrontWallpaper || images.businesses.corner_store,
        dataAiHint: 'business'
      }));

    const matchingBusinesses = processedBusinesses.filter((biz) => {
      if (!searchQuery) return true;
      return [biz.businessName, biz.fullName, biz.address, biz.city, biz.subcategoryName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchQuery));
    });

    if (userLocation) {
      const { latitude, longitude } = userLocation.coordinates;
      const nearbyBusinesses = matchingBusinesses
        .filter((biz) => Number.isFinite(biz.lat) && Number.isFinite(biz.lon))
        .map((biz) => ({
          ...biz,
          distance: calculateDistance(latitude, longitude, biz.lat as number, biz.lon as number),
        }))
        .filter((biz) => biz.distance <= PROXIMITY_RADIUS_KM)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 50);

      // GPS is a sorting/filtering aid, not a hard requirement for discovery.
      // Keep registered businesses visible when coordinates are missing or the
      // member is outside the radius, especially for an explicit name search.
      setDisplayedBusinesses(nearbyBusinesses.length > 0 ? nearbyBusinesses : matchingBusinesses.slice(0, 50));
    } else {
      setDisplayedBusinesses(matchingBusinesses.slice(0, 50));
    }
  }, [fetchedBusinesses, liveCategories, userLocation, searchQuery, categoryParam, subcategoryParam]);


  const roleTitle = t(`roles.${roleParam}`); // Use original plural param for display
  const liveSub = subcategoryParam ? resolveLiveSubcategory(liveCategories, decodeURIComponent(subcategoryParam)) : null;
  const liveParent = topLevelCategories(liveCategories).find((p) => normText(p.name) === normText(decodeURIComponent(categoryParam)) || normText(categoryKeyFor(p)) === normText(decodeURIComponent(categoryParam)));
  const categoryTitle = liveSub ? `${liveSub.parent.name} · ${liveSub.child.name}` : liveParent ? liveParent.name : category === 'all' ? 'All Businesses' : capitalize(category.replace(/-/g, ' '));
  const isLocationEnabled = !!userLocation;
  const hasNearbyResults = isLocationEnabled && displayedBusinesses.some((biz) => biz.distance !== undefined);

  if (loading || categoriesLoading) {
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
                        <div className="flex items-center gap-1 text-sm font-semibold text-primary mt-2">
                            <Navigation className="h-4 w-4" />
                            {formatDistance(biz.distance)}
                        </div>
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
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <LocateFixed className="h-4 w-4" />
            {isLoadingLocation ? 'Getting your location…' : hasNearbyResults ? `Showing businesses within ${PROXIMITY_RADIUS_KM} km, nearest first` : isLocationEnabled ? `No businesses with valid coordinates found within ${PROXIMITY_RADIUS_KM} km. Showing category matches instead.` : 'Location unavailable — showing category matches without distance filtering'}
          </span>
        </div>
        {locationMessage && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm" role="status">
            <span>{locationMessage}</span>
            <Button variant="outline" size="sm" onClick={() => setLocationAttempt((attempt) => attempt + 1)} disabled={isLoadingLocation}>
              {isLoadingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
              Retry location
            </Button>
          </div>
        )}
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

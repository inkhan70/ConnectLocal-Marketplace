"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import type { UserProfile } from "@/contexts/AuthContext";
import { collection, query, where } from "firebase/firestore";
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Loader2, ArrowRight } from 'lucide-react';
import images from '@/app/lib/placeholder-images.json';

const TEN_DAYS_IN_MS = 10 * 24 * 60 * 60 * 1000;

export function NewBusinesses() {
    const firestore = useFirestore();
    const [newBusinesses, setNewBusinesses] = useState<UserProfile[]>([]);

    const businessRoles = ["company", "wholesaler", "distributor", "shopkeeper"];
    const businessesQuery = useMemoFirebase(
        () => query(collection(firestore, 'users'), where('role', 'in', businessRoles)),
        [firestore]
    );
    const { data: allBusinesses, isLoading } = useCollection<UserProfile>(businessesQuery);

    useEffect(() => {
        if (allBusinesses) {
            const now = new Date().getTime();
            const filtered = allBusinesses.filter(biz => {
                if (!biz.createdAt) return false;
                const creationDate = new Date(biz.createdAt).getTime();
                return (now - creationDate) < TEN_DAYS_IN_MS;
            });
            setNewBusinesses(filtered);
        }
    }, [allBusinesses]);
    
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Looking for new businesses...</p>
            </div>
        );
    }

    if (newBusinesses.length === 0) {
        return null; // Don't render the section if there are no new businesses
    }

    return (
        <div>
            <h2 className="text-3xl font-bold font-headline text-center mb-2">Welcome Our Newest Members!</h2>
            <p className="text-muted-foreground text-center mb-8">Get a first look at the latest businesses to join our community.</p>

            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              className="w-full"
            >
                <CarouselContent>
                    {newBusinesses.map(biz => (
                        <CarouselItem key={biz.uid} className="md:basis-1/2 lg:basis-1/3">
                            <div className="p-1">
                                <Card className="flex flex-col h-full">
                                    <CardHeader className="p-0">
                                      <Image 
                                        src={biz.storefrontWallpaper || images.businesses.corner_store} 
                                        alt={biz.businessName || ''} 
                                        width={400} 
                                        height={200} 
                                        className="rounded-t-lg object-cover w-full h-40" 
                                        data-ai-hint="storefront exterior" 
                                      />
                                    </CardHeader>
                                    <CardContent className="p-4 flex-grow">
                                        <CardTitle className="font-headline text-xl">{biz.businessName}</CardTitle>
                                        <p className="text-sm text-muted-foreground">{biz.city}, {biz.state}</p>
                                    </CardContent>
                                    <CardFooter className="p-4 pt-0">
                                        <Button asChild className="w-full">
                                            <Link href={`/products/distributor/${biz.uid}`}>
                                                Visit Storefront <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="hidden sm:flex" />
                <CarouselNext className="hidden sm:flex" />
            </Carousel>
        </div>
    );
}

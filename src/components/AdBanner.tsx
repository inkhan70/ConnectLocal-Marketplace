
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Award, ShoppingBag, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';

interface Ad {
    id: string;
    title: string;
    description: string;
    icon: "ShoppingBag" | "Award" | "Megaphone";
    targetAudience: string[];
}

const iconMap = {
    ShoppingBag,
    Award,
    Megaphone
};

const SESSION_STORAGE_KEY_PREFIX = 'adBannerDismissed_';

export function AdBanner() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { userProfile } = useAuth();
  const firestore = useFirestore();
  
  const currentUserRole = userProfile?.role || 'guest';

  const adsQuery = useMemoFirebase(() => query(collection(firestore, 'ads')), [firestore]);
  const { data: allAds, isLoading } = useCollection<Ad>(adsQuery);


  useEffect(() => {
    if (isLoading || !allAds) return;

    // 1. Find a suitable ad for the current user
    const suitableAds = allAds.filter(ad => ad.targetAudience.includes(currentUserRole));
    const selectedAd = suitableAds.length > 0 ? suitableAds[0] : null;
    
    if (selectedAd) {
        setAd(selectedAd);
        // 2. Check if this specific ad has been dismissed this session.
        const dismissed = sessionStorage.getItem(SESSION_STORAGE_KEY_PREFIX + selectedAd.id);
        if (dismissed !== 'true') {
          setIsVisible(true);
        }
    }

  }, [currentUserRole, allAds, isLoading]);

  const handleDismiss = () => {
    if (ad) {
      sessionStorage.setItem(SESSION_STORAGE_KEY_PREFIX + ad.id, 'true');
    }
    setIsVisible(false);
  };

  if (!isVisible || !ad) {
    return null;
  }
  
  const AdIcon = iconMap[ad.icon] || Megaphone;

  return (
    <div className="container mx-auto px-4 pt-6">
        <Card className="bg-primary/10 border-primary/20 relative">
        <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <div className="bg-primary/20 p-2 rounded-full">
                    <AdIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h3 className="font-bold text-primary">{ad.title}</h3>
                    <p className="text-sm text-primary/80">
                        {ad.description}
                    </p>
                </div>
            </div>
            <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                className="absolute top-2 right-2 h-7 w-7 text-primary/70 hover:text-primary hover:bg-primary/10"
                aria-label="Dismiss"
            >
                <X className="h-4 w-4" />
            </Button>
        </CardContent>
        </Card>
    </div>
  );
}

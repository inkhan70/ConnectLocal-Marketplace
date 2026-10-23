
"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { useState } from "react";

export interface Address {
    address: string;
    city: string;
    state: string;
}

interface ItemDeliveryProps {
    address: Address;
    onAddressChange: (address: Address) => void;
}


export function ItemDelivery({ address, onAddressChange }: ItemDeliveryProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onAddressChange({
      ...address,
      [name]: value,
    });
  };

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser does not support geolocation.",
        variant: "destructive",
      });
      return;
    }
    
    setIsFetchingLocation(true);

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                // Use a free reverse geocoding service
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();

                if (data && data.address) {
                    const { road, house_number, city, state, postcode, country } = data.address;
                    const street = `${house_number || ''} ${road || ''}`.trim();
                    onAddressChange({
                        address: street || data.display_name,
                        city: city || "",
                        state: state || "",
                    });
                    toast({
                        title: "Location Fetched",
                        description: `Your address fields have been pre-filled.`,
                    });
                } else {
                    throw new Error("Could not find address details.");
                }
            } catch (error) {
                toast({
                    title: "Could Not Fetch Address",
                    description: "Unable to convert coordinates to an address. Please enter it manually.",
                    variant: "destructive"
                });
                onAddressChange({
                    address: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
                    city: "Geolocated City",
                    state: "Geolocated State",
                });
            } finally {
                setIsFetchingLocation(false);
            }
        },
        (error) => {
            let title = "Location Error";
            let description = "Could not fetch your location. Please try again or enter your address manually.";

            if (error.code === error.PERMISSION_DENIED) {
                title = "Location Access Denied";
                description = "You have denied location access. Please fill in your address manually.";
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                title = "Location Unavailable";
                description = "Your location could not be determined. Please ensure your device's GPS is turned on and try again.";
            } else if (error.code === error.TIMEOUT) {
                title = "Location Request Timed Out";
                description = "Fetching your location took too long. Please try again or enter your address manually.";
            }
            
            toast({
              title: title,
              description: description,
              variant: "destructive",
            });
            setIsFetchingLocation(false);
        },
        {
            timeout: 10000 // 10-second timeout
        }
    );
  };


  return (
    <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg">{t('item_detail.delivery_info')}</h3>
        </div>
        
        <div className="space-y-2">
            <Label>Manual Entry</Label>
            <p className="text-sm text-muted-foreground">If you prefer, enter your business address details below.</p>
             <div>
                <Label htmlFor="address-manual" className="text-xs">{t('signup.address')}</Label>
                <Input id="address-manual" name="address" placeholder={t('signup.address_placeholder')} value={address.address} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="city-manual" className="text-xs">{t('signup.city')}</Label>
                    <Input id="city-manual" name="city" placeholder={t('signup.city_placeholder')} value={address.city} onChange={handleInputChange} />
                </div>
                 <div>
                    <Label htmlFor="state-manual" className="text-xs">State / Province</Label>
                    <Input id="state-manual" name="state" placeholder="e.g., California" value={address.state} onChange={handleInputChange} />
                </div>
            </div>
        </div>

        <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
        </div>
        
        <div>
             <Button type="button" variant="outline" className="w-full" onClick={handleGetCurrentLocation} disabled={isFetchingLocation}>
                {isFetchingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                {isFetchingLocation ? "Fetching Location..." : "GPS Location"}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
                Let your browser find your location automatically.
            </p>
        </div>
    </div>
  );
}

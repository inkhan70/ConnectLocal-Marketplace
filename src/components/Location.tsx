
"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFormContext } from "react-hook-form";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { useState } from "react";

export function Location() {
  const { control, setValue } = useFormContext();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

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

            setValue("address", street || data.display_name, { shouldValidate: true });
            setValue("city", city || '', { shouldValidate: true });
            setValue("state", state || '', { shouldValidate: true });
            
            toast({
              title: "Location Fetched",
              description: "Your address fields have been pre-filled.",
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
           // Fallback for when reverse geocoding fails
           setValue("address", `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
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
            <h3 className="font-semibold text-lg">Business Location</h3>
        </div>
        
        <div className="space-y-2">
            <Label>Manual Entry</Label>
            <p className="text-sm text-muted-foreground">If you prefer, enter your business address details below.</p>
             <FormField
                control={control}
                name="address"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('signup.address')}</FormLabel>
                    <FormControl>
                    <Input placeholder={t('signup.address_placeholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={control}
                name="city"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>{t('signup.city')}</FormLabel>
                    <FormControl>
                        <Input placeholder={t('signup.city_placeholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={control}
                name="state"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>State / Province</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., California" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
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

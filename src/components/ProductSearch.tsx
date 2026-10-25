
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { useLanguage } from '@/contexts/LanguageContext';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface ProductSearchProps {
    placeholder?: string;
}

export function ProductSearch({ placeholder }: ProductSearchProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [city, setCity] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [maxDistance, setMaxDistance] = useState('100');
  const [date, setDate] = useState<Date>();

  const businessTypes = [
    'doctor', 'medical-store', 'restaurant', 'cafe', 'car-dealership', 
    'hotel', 'shopkeeper', 'wholesaler', 'distributor', 'manufacturer'
  ];

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }
    if (city.trim()) {
      params.set('city', city.trim());
    }
    if (businessType.trim()) {
      params.set('businessType', businessType.trim());
    }
    if (minPrice.trim()) {
      params.set('minPrice', minPrice.trim());
    }
    if (maxPrice.trim()) {
      params.set('maxPrice', maxPrice.trim());
    }
    if (maxDistance.trim()) {
      params.set('maxDistance', maxDistance.trim());
    }

    if (params.toString()) {
        router.push(`/search?${params.toString()}`);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder={placeholder || t('product_search.placeholder')}
            className="pl-10 text-base py-6"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2">
            {t('product_search.search_button')}
          </Button>
        </div>
      </form>
      
      <Accordion type="single" collapsible>
        <AccordionItem value="advanced-search" className="border-b-0">
          <AccordionTrigger>
            <div className='flex items-center gap-2'>
              <SlidersHorizontal className="h-4 w-4" />
              {t('product_search.advanced_search')}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-md bg-muted/50">
              {/* City */}
               <div className="space-y-2">
                <Label htmlFor="city">{t('signup.city')}</Label>
                <Input 
                    id="city" 
                    placeholder={t('signup.city_placeholder')} 
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                />
              </div>

              {/* Business Type */}
              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type</Label>
                <select 
                    id="businessType"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <option value="">All Types</option>
                    {businessTypes.map(type => (
                        <option key={type} value={type}>
                            {type.replace('-', ' ').charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                    ))}
                </select>
              </div>

              {/* Price Range */}
              <div className="space-y-2">
                <Label htmlFor="min-price">{t('product_search.price_range')}</Label>
                <div className="flex items-center gap-2">
                  <Input 
                      id="min-price" 
                      type="number" 
                      placeholder={t('product_search.min')}
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                  />
                  <span>-</span>
                  <Input 
                      id="max-price" 
                      type="number" 
                      placeholder={t('product_search.max')}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Distance Radius */}
              <div className="space-y-2">
                <Label htmlFor="distance">Radius (km)</Label>
                <Input 
                    id="distance"
                    type="number"
                    placeholder="100"
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(e.target.value)}
                    min="1"
                    max="500"
                />
              </div>
              
              {/* Weight */}
              <div className="space-y-2">
                <Label htmlFor="weight">{t('product_search.weight')}</Label>
                <Input id="weight" placeholder={t('product_search.weight_placeholder')} />
              </div>

              {/* Volume */}
              <div className="space-y-2">
                <Label htmlFor="volume">{t('product_search.volume')}</Label>
                <Input id="volume" placeholder={t('product_search.volume_placeholder')} />
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label htmlFor="color">{t('product_search.color')}</Label>
                <Input id="color" placeholder={t('product_search.color_placeholder')} />
              </div>

              {/* Release Date */}
              <div className="space-y-2">
                <Label>{t('product_search.release_date')}</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>{t('product_search.date_placeholder')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="type">{t('product_search.type')}</Label>
                <Input id="type" placeholder={t('product_search.type_placeholder')} />
              </div>

              {/* Size */}
              <div className="space-y-2">
                <Label htmlFor="size">{t('product_search.size')}</Label>
                <Input id="size" placeholder={t('product_search.size_placeholder')} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

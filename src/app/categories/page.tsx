"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { UtensilsCrossed, GlassWater, Laptop, Pill, Footprints, Scissors, Gem, Building, MoreHorizontal, Settings, Shirt, Home, Car, Wrench, Bone, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Wallpaper } from '@/components/Wallpaper';
import { WallpaperManager } from '@/components/WallpaperManager';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { CategoryItem } from '@/lib/category-management';
import { database } from '@/firebase';
import { onValue, ref } from 'firebase/database';

const iconMap: { [key: string]: React.ElementType } = {
  UtensilsCrossed, GlassWater, Laptop, Pill, Footprints, Scissors, Gem, Building, MoreHorizontal, Shirt, Home, Car, Wrench, Bone
};

interface CategoryDoc {
  list: CategoryItem[];
}

const defaultCategories: CategoryItem[] = [
    { id: 'cat1', name: 'Food', icon: 'UtensilsCrossed', order: 1, isActive: true },
    { id: 'cat2', name: 'Drinks', icon: 'GlassWater', order: 2, isActive: true },
    { id: 'cat3', name: 'Electronics', icon: 'Laptop', order: 3, isActive: true },
    { id: 'cat4', name: 'Medical', icon: 'Pill', order: 4, isActive: true },
    { id: 'cat5', name: 'Shoes', icon: 'Footprints', order: 5, isActive: true },
    { id: 'cat6', name: 'Beauty', icon: 'Scissors', order: 6, isActive: true },
    { id: 'cat7', name: 'Jewelry', icon: 'Gem', order: 7, isActive: true },
    { id: 'cat8', name: 'Real Estate', icon: 'Building', order: 8, isActive: true },
    { id: 'cat9', name: 'Apparel', icon: 'Shirt', order: 9, isActive: true },
    { id: 'cat10', name: 'Home & Garden', icon: 'Home', order: 10, isActive: true },
    { id: 'cat11', name: 'Automotive', icon: 'Car', order: 11, isActive: true },
    { id: 'cat12', name: 'Services', icon: 'Wrench', order: 12, isActive: true },
    { id: 'cat13', name: 'Pets', icon: 'Bone', order: 13, isActive: true },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const { t } = useLanguage();
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();

  useEffect(() => {
    const categoryRef = ref(database, 'categories');
    const unsubscribe = onValue(categoryRef, (snapshot) => {
      const value = snapshot.val() as Record<string, any> | null;
      if (!value) return;
      const live = Object.entries(value).map(([id, item]) => ({ id, ...item, order: Number(item.sortOrder ?? item.order ?? 0), isActive: item.enabled !== false && item.isActive !== false, parentId: item.parentId || null } as CategoryItem)).filter((item) => item.isActive !== false);
      if (live.length) setCategories(live.sort((a, b) => a.order - b.order));
    });

    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories', { headers: { 'Content-Type': 'application/json' } });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(payload.list) && payload.list.length > 0) {
          const data: CategoryItem[] = payload.list.filter((item: CategoryItem) => item.isActive !== false);
          setCategories(data.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
          return;
        }
        setCategories(defaultCategories);
      } catch (error) {
        console.error('Failed to load categories:', error);
        setCategories(defaultCategories);
      }
    };

    void loadCategories();
    return unsubscribe;
  }, []);

  const topLevelCategories = useMemo(
    () => categories.filter((category) => !category.parentId && category.isActive !== false),
    [categories],
  );

  const getCategoryLink = (category: CategoryItem) => {
    const categoryName = category.name.toLowerCase().replace(/\s+/g, '-');
    if (category.name === 'Services') {
      return `/businesses?category=${categoryName}&role=company`;
    }
    return `/roles?category=${categoryName}`;
  };

  return (
    <>
      <Wallpaper />
      <div className="container mx-auto px-4 py-12 relative">
        <WallpaperManager />
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold font-headline leading-tight tracking-tighter">
            {t('categories.title')}
          </h1>
          <p className="max-w-xl mx-auto text-lg text-muted-foreground mt-4">
            {t('categories.description')}
          </p>
          {isAdmin && (
            <div className="mt-6">
              <Button asChild>
                <Link href="/admin/categories">
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Categories
                </Link>
              </Button>
            </div>
          )}
        </div>

        {categories.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="font-semibold">No categories found.</p>
            <p>It looks like the category list is empty. An administrator can add categories via the admin panel.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mt-12">
            {topLevelCategories.map((category) => {
              const IconComponent = iconMap[category.icon || 'MoreHorizontal'] || MoreHorizontal;
              const subcategories = categories.filter((entry) => entry.parentId === category.id && entry.isActive !== false);
              const hasSubcategories = subcategories.length > 0;

              if (hasSubcategories) {
                return (
                  <Accordion key={category.id} type="single" collapsible className="relative group col-span-2 md:col-span-1">
                    <AccordionItem value={`category-${category.id}`} className="border-none">
                      <Card className="text-center hover:shadow-xl transition-shadow duration-300 ease-in-out h-full">
                        <AccordionTrigger className="hover:no-underline p-0">
                          <CardContent className="p-6 flex flex-col items-center justify-center w-full">
                            <IconComponent className="h-12 w-12 mb-4 text-primary group-hover:text-accent transition-colors" />
                            <h3 className="text-lg font-bold font-headline">{category.name}</h3>
                          </CardContent>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 px-4">
                          <div className="flex flex-col space-y-2 max-h-64 overflow-y-auto">
                            {subcategories.map((sub) => (
                              <Button key={sub.id} variant="ghost" asChild className="justify-start">
                                <Link href={`/businesses?category=${encodeURIComponent(category.name.toLowerCase())}&role=${encodeURIComponent(sub.slug || sub.name.toLowerCase())}&subcategory=${encodeURIComponent(sub.id)}`}>
                                  {sub.name}
                                </Link>
                              </Button>
                            ))}
                          </div>
                        </AccordionContent>
                      </Card>
                    </AccordionItem>
                  </Accordion>
                );
              }

              return (
                <div key={category.id} className="relative group">
                  <Link href={getCategoryLink(category)}>
                    <Card className="text-center hover:shadow-xl hover:-translate-y-1 transition-transform duration-300 ease-in-out h-full">
                      <CardContent className="p-6 flex flex-col items-center justify-center">
                        <IconComponent className="h-12 w-12 mb-4 text-primary group-hover:text-accent transition-colors" />
                        <h3 className="text-lg font-bold font-headline">{category.name}</h3>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

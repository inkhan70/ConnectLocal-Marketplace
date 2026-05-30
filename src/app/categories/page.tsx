
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { UtensilsCrossed, GlassWater, Laptop, Pill, Footprints, Scissors, Gem, Building, MoreHorizontal, Settings, Shirt, Home, Car, Wrench, Bone, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Wallpaper } from '@/components/Wallpaper';
import { WallpaperManager } from '@/components/WallpaperManager';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getSubcategoriesForCategory } from '@/lib/subcategories';

const iconMap: { [key: string]: React.ElementType } = {
    UtensilsCrossed, GlassWater, Laptop, Pill, Footprints, Scissors, Gem, Building, MoreHorizontal, Shirt, Home, Car, Wrench, Bone
};

export interface Category {
    id: string;
    name: string;
    icon: string;
    order: number;
}

interface CategoriesDoc {
    list: Category[];
}

const defaultCategories: Category[] = [
    { id: 'cat1', name: 'Food', icon: "UtensilsCrossed", order: 1},
    { id: 'cat2', name: 'Drinks', icon: "GlassWater", order: 2},
    { id: 'cat3', name: 'Electronics', icon: "Laptop", order: 3},
    { id: 'cat4', name: 'Medical', icon: "Pill", order: 4},
    { id: 'cat5', name: 'Shoes', icon: "Footprints", order: 5},
    { id: 'cat6', name: 'Beauty', icon: "Scissors", order: 6},
    { id: 'cat7', name: 'Jewelry', icon: "Gem", order: 7},
    { id: 'cat8', name: 'Real Estate', icon: "Building", order: 8},
    { id: 'cat9', name: 'Apparel', icon: 'Shirt', order: 9 },
    { id: 'cat10', name: 'Home & Garden', icon: 'Home', order: 10 },
    { id: 'cat11', name: 'Automotive', icon: 'Car', order: 11 },
    { id: 'cat12', name: 'Services', icon: 'Wrench', order: 12 },
    { id: 'cat13', name: 'Pets', icon: 'Bone', order: 13 },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const { t } = useLanguage();
  const { userProfile } = useAuth();
  const firestore = useFirestore();

  const categoriesDocRef = useMemoFirebase(() => doc(firestore, 'app_config', 'categories'), [firestore]);
  const { data: categoriesDoc, isLoading: loading, error } = useDoc<CategoriesDoc>(categoriesDocRef);

  useEffect(() => {
    // If there's an error (like permission denied for guests before rules update),
    // or if we're done loading and the document doesn't exist, use the default categories.
    if (error || (!loading && !categoriesDoc)) {
      setCategories(defaultCategories);
      return;
    }
    
    // If we have a document and the list is valid, use it.
    if (categoriesDoc && categoriesDoc.list && categoriesDoc.list.length > 0) {
      setCategories(categoriesDoc.list.sort((a, b) => a.order - b.order));
    }
    // If the doc exists but list is empty, `categories` remains empty, which is handled in JSX.
  }, [categoriesDoc, loading, error]);

  const getCategoryLink = (category: Category) => {
    const categoryName = category.name.toLowerCase().replace(/\s+/g, '-');
    if (category.name === 'Services') {
      // For Services, skip the roles page and go directly to businesses.
      // We can default to a common role like 'company' or any other logic.
      return `/businesses?category=${categoryName}&role=company`;
    }
    return `/roles?category=${categoryName}`;
  }

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
        {userProfile?.isAdmin && (
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

        {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        ) : categories.length === 0 ? (
             <div className="text-center text-muted-foreground py-12">
                <p className="font-semibold">No categories found.</p>
                <p>It looks like the category list is empty. An administrator can add categories via the admin panel.</p>
            </div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mt-12">
                {categories.map((category) => {
                    const IconComponent = iconMap[category.icon] || MoreHorizontal;
                    const subcategories = getSubcategoriesForCategory(category.name);
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
                                                {subcategories.map(sub => (
                                                    <Button key={sub.id} variant="ghost" asChild className="justify-start">
                                                        <Link href={`/signup?category=${category.name}&subcategory=${sub.id}`}>
                                                            {sub.name}
                                                        </Link>
                                                    </Button>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </Card>
                                </AccordionItem>
                            </Accordion>
                        )
                    }

                    return (
                        <div key={category.id} className="relative group">
                            <Link href={getCategoryLink(category)} >
                                <Card className="text-center hover:shadow-xl hover:-translate-y-1 transition-transform duration-300 ease-in-out h-full">
                                <CardContent className="p-6 flex flex-col items-center justify-center">
                                    <IconComponent className="h-12 w-12 mb-4 text-primary group-hover:text-accent transition-colors" />
                                    <h3 className="text-lg font-bold font-headline">{category.name}</h3>
                                </CardContent>
                                </Card>
                            </Link>
                        </div>
                    )
                })}
            </div>
        )}
    </div>
    </>
  );
}

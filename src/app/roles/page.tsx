
"use client"

import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { useLiveCategories } from '@/hooks/use-live-categories';
import { childCategories, normText, topLevelCategories, categoryKeyFor } from '@/lib/category-live';
import { Suspense } from "react";
import { useLanguage } from '@/contexts/LanguageContext';

function RolesContent() {
    const searchParams = useSearchParams();
    const { t } = useLanguage();
    const category = searchParams.get('category') || 'all';

    const categoryName = decodeURIComponent(category).replace(/-/g, ' ');
    const categoryTitle = categoryName.replace(/\b\w/g, (letter) => letter.toUpperCase());
    const { list: liveCategories } = useLiveCategories();
    const parent = topLevelCategories(liveCategories).find((p) => [normText(p.name), normText(categoryKeyFor(p))].includes(normText(categoryName)));
    const subcategories = parent ? childCategories(liveCategories, parent.id) : [];

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-12">
                <p className="text-lg text-muted-foreground">{t('roles.showing_results')}</p>
                <h1 className="text-4xl md:text-5xl font-extrabold font-headline leading-tight tracking-tighter">
                {categoryTitle}
                </h1>
                <p className="max-w-xl mx-auto text-lg text-muted-foreground mt-4">
                {t('roles.who_are_you_looking_for')} {categoryTitle}?
                </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {subcategories.map((subcategory) => (
                <Link key={subcategory.id} href={`/businesses?category=${encodeURIComponent(categoryName)}&subcategory=${encodeURIComponent(subcategory.id)}`}>
                    <Card className="text-center hover:shadow-xl hover:-translate-y-1 transition-transform duration-300 ease-in-out h-full group">
                    <CardContent className="p-7 flex flex-col items-center justify-center min-h-48">
                        <BriefcaseBusiness className="h-12 w-12 mb-5 text-primary group-hover:text-accent transition-colors" />
                        <h3 className="text-xl font-bold font-headline mb-2">{subcategory.name}</h3>
                        <div className="flex items-center text-sm text-muted-foreground group-hover:text-accent transition-colors">
                            View businesses <ArrowRight className="ml-2 h-4 w-4" />
                        </div>
                    </CardContent>
                    </Card>
                </Link>
                ))}
            </div>
            {subcategories.length === 0 && <p className="text-center text-muted-foreground">No active subcategories are available for this category.</p>}
        </div>
    );
}


export default function RolesPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RolesContent />
        </Suspense>
    )
}

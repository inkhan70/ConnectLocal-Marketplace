
"use client"

import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Factory, Warehouse, Truck, Store, ArrowRight } from "lucide-react";
import { Suspense } from "react";
import { useLanguage } from '@/contexts/LanguageContext';

function RolesContent() {
    const searchParams = useSearchParams();
    const { t } = useLanguage();
    const category = searchParams.get('category') || 'all';

    const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);

    const roles = [
      { name: t('roles.producers'), param: 'producers', icon: Factory, href: (category: string) => `/businesses?category=${category}&role=producers` },
      { name: t('roles.wholesalers'), param: 'wholesalers', icon: Warehouse, href: (category: string) => `/businesses?category=${category}&role=wholesalers` },
      { name: t('roles.distributors'), param: 'distributors', icon: Truck, href: (category: string) => `/businesses?category=${category}&role=distributors` },
      { name: t('roles.shopkeepers'), param: 'shopkeepers', icon: Store, href: (category: string) => `/businesses?category=${category}&role=shopkeepers` },
    ];

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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {roles.map((role) => (
                <Link key={role.name} href={role.href(category)}>
                    <Card className="text-center hover:shadow-xl hover:-translate-y-1 transition-transform duration-300 ease-in-out h-full group">
                    <CardContent className="p-8 flex flex-col items-center justify-center">
                        <role.icon className="h-16 w-16 mb-6 text-primary group-hover:text-accent transition-colors" />
                        <h3 className="text-2xl font-bold font-headline mb-2">{role.name}</h3>
                        <div className="flex items-center text-sm text-muted-foreground group-hover:text-accent transition-colors">
                            {t('roles.view_all')} {role.name} <ArrowRight className="ml-2 h-4 w-4" />
                        </div>
                    </CardContent>
                    </Card>
                </Link>
                ))}
            </div>
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

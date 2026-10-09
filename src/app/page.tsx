
"use client";

import { AdBanner } from '@/components/AdBanner';
import { Wallpaper } from '@/components/Wallpaper';
import { WallpaperManager } from '@/components/WallpaperManager';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProductSearch } from '@/components/ProductSearch';
import images from '@/app/lib/placeholder-images.json';
import { Separator } from '@/components/ui/separator';
import { NewBusinesses } from '@/components/NewBusinesses';

export default function Home() {
  const { t } = useLanguage();

  return (
    <>
      <Wallpaper />
      <AdBanner />
      <div className="flex flex-col">
        <section className="relative container mx-auto px-4 py-20 md:py-32">
          <WallpaperManager />

          <ProductSearch placeholder="Search for products, businesses, or cities..." />

          <div className="grid md:grid-cols-2 gap-12 items-center mt-12">
            <div className="flex flex-col items-start text-left">
              <h1 className="text-4xl md:text-6xl font-extrabold font-headline leading-tight tracking-tighter text-primary">
                {t('home.title')}
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground my-8">
                business_web is a business community where you can find thousands of businesses across the globe related to your needs. Here you can find the best quality products with low prices and custom search. If you are a producer, distributor, wholesaler, shopkeeper, or supply row materials for producers, then this is the best place for you to bring your business online with our community of thousands of customers who buy your products rapidly.
              </p>
              
              <p className="max-w-xl text-sm text-muted-foreground my-8">
                {t('home.sub_description_1')}{' '}
                <Link href="/signup" className="text-primary underline hover:opacity-80">
                  {t('home.sign_up')}
                </Link>{' '}
                {t('home.sub_description_2')}, {t('home.or')}{' '}
                <Link href="/signin" className="text-primary underline hover:opacity-80">
                  {t('home.sign_in')}
                </Link>{' '}
                {t('home.sub_description_3')}.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Button size="lg" asChild variant="shine">
                  <Link href="/categories">
                    {t('home.explore_categories')} <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                 <Button size="lg" variant="secondary" asChild>
                  <Link href="/signup">
                    {t('home.get_started')}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="hidden md:block">
              <Image 
                src={images.home.hero}
                alt="City illustration with shops and people"
                width={600}
                height={400}
                className="rounded-xl shadow-2xl"
                data-ai-hint="vegetable stand"
              />
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <NewBusinesses />
        </section>

      </div>
    </>
  );
}

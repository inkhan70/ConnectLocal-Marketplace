
"use client";

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-secondary text-secondary-foreground border-t border-border">
      <div className="container mx-auto py-12 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="mb-4 md:mb-0">
            <h3 className="text-2xl font-headline font-bold text-secondary-foreground">business_web</h3>
            <p className="text-sm text-secondary-foreground/70 mt-2">{t('footer.tagline')}</p>
          </div>
          <div className="flex flex-col md:flex-row md:space-x-8 space-y-3 md:space-y-0 text-sm">
            <Link href="/about" className="text-secondary-foreground/80 hover:text-secondary-foreground transition-colors">{t('footer.about')}</Link>
            <Link href="/contact" className="text-secondary-foreground/80 hover:text-secondary-foreground transition-colors">{t('footer.contact')}</Link>
            <Link href="/privacy" className="text-secondary-foreground/80 hover:text-secondary-foreground transition-colors">{t('footer.privacy')}</Link>
            <Link href="/terms" className="text-secondary-foreground/80 hover:text-secondary-foreground transition-colors">{t('footer.terms')}</Link>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-secondary-foreground/20 text-center text-xs text-secondary-foreground/60">
          <p>&copy; {new Date().getFullYear()} business_web. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

    

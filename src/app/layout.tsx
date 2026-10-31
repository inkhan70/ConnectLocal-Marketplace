
import type {Metadata} from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { cn } from "@/lib/utils";
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { FirebaseProvider } from '@/contexts/FirebaseContext';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export const metadata: Metadata = {
  title: 'business_web',
  description: 'Find and connect with local businesses and distributors in your city.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = cookies().get('connectlocal_locale')?.value || 'en';
  const safeLocale = ['en', 'ur', 'ar', 'fa', 'hi'].includes(locale) ? locale : 'en';
  const direction = ['ur', 'ar', 'fa'].includes(safeLocale) ? 'rtl' : 'ltr';

  return (
    <html lang={safeLocale} dir={direction} suppressHydrationWarning className="bg-background">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&family=Playfair+Display:wght@700&family=PT+Sans:wght@400;700&family=Vazirmatn:wght@400;600;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png"></link>
        <meta name="theme-color" content="#0052CC" />
      </head>
      <body className={cn("min-h-screen bg-background font-body antialiased")}>
        <FirebaseProvider>
          <AuthProvider>
            <LanguageProvider>
              <FavoritesProvider>
                  <CartProvider>
                    <FirebaseErrorListener />
                    <div className="relative flex min-h-screen flex-col">
                      <Header />
                      <main className="flex-1">{children}</main>
                      <Footer />
                    </div>
                    <Toaster />
                  </CartProvider>
              </FavoritesProvider>
            </LanguageProvider>
          </AuthProvider>
        </FirebaseProvider>
      </body>
    </html>
  );
}

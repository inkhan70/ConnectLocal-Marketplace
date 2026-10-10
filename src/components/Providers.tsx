
"use client";

import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { FirebaseProvider } from '@/contexts/FirebaseContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <FirebaseProvider>
            <AuthProvider>
              <LanguageProvider>
                <FavoritesProvider>
                    <CartProvider>
                    {children}
                    </CartProvider>
                </FavoritesProvider>
              </LanguageProvider>
            </AuthProvider>
        </FirebaseProvider>
    );
}

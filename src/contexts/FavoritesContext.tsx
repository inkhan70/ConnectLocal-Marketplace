"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/firebase';

const GUEST_FAVORITES_KEY = 'connectlocal.guestFavorites.v2';
const GUEST_RECENT_KEY = 'connectlocal.guestRecentBusinesses.v1';
const MAX_GUEST_ITEMS = 100;

export interface FavoriteBusiness {
  id: string;
  name: string;
  address: string;
  image?: string;
  dataAiHint?: string;
  category?: string;
  role?: string;
  savedAt?: number;
  lastContactedAt?: number;
}

interface FavoritesContextType {
  favorites: FavoriteBusiness[];
  recentlyContacted: FavoriteBusiness[];
  addFavorite: (business: FavoriteBusiness) => Promise<void>;
  removeFavorite: (businessId: string) => Promise<void>;
  isFavorite: (businessId: string) => boolean;
  recordContact: (business: FavoriteBusiness) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

function readLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(key: string, items: FavoriteBusiness[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_GUEST_ITEMS)));
  } catch (error) {
    console.error(`Failed to persist ${key}`, error);
  }
}

function mergeBusinesses(items: FavoriteBusiness[]): FavoriteBusiness[] {
  const byId = new Map<string, FavoriteBusiness>();
  for (const item of items) {
    if (!item?.id) continue;
    const existing = byId.get(item.id);
    byId.set(item.id, { ...existing, ...item });
  }
  return Array.from(byId.values());
}

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const firestore = useFirestore();
  const [favorites, setFavorites] = useState<FavoriteBusiness[]>([]);
  const [recentlyContacted, setRecentlyContacted] = useState<FavoriteBusiness[]>([]);
  const syncingGuestData = useRef(false);

  // Guest data is deliberately local-only. It never exposes a guest identity to Firestore.
  useEffect(() => {
    if (user) return;
    syncingGuestData.current = false;
    setFavorites(readLocal<FavoriteBusiness>(GUEST_FAVORITES_KEY));
    setRecentlyContacted(readLocal<FavoriteBusiness>(GUEST_RECENT_KEY));
  }, [user]);

  // Registered buyers get durable, cross-device favourites and recent contacts.
  useEffect(() => {
    if (!user) return;

    const favoritesRef = collection(firestore, 'users', user.uid, 'favorites');
    const recentRef = collection(firestore, 'users', user.uid, 'recentBusinesses');

    const unsubFavorites = onSnapshot(favoritesRef, (snapshot) => {
      setFavorites(snapshot.docs.map((item) => item.data() as FavoriteBusiness));
    }, (error) => console.error('Failed to sync favourites', error));

    const unsubRecent = onSnapshot(recentRef, (snapshot) => {
      const items = snapshot.docs
        .map((item) => item.data() as FavoriteBusiness)
        .sort((a, b) => (b.lastContactedAt || 0) - (a.lastContactedAt || 0));
      setRecentlyContacted(items.slice(0, MAX_GUEST_ITEMS));
    }, (error) => console.error('Failed to sync recent businesses', error));

    // One-time migration: preserve guest favourites when the visitor creates/signs into an account.
    if (!syncingGuestData.current) {
      syncingGuestData.current = true;
      const guestFavorites = readLocal<FavoriteBusiness>(GUEST_FAVORITES_KEY);
      const guestRecent = readLocal<FavoriteBusiness>(GUEST_RECENT_KEY);
      void Promise.all([
        ...guestFavorites.map((business) => setDoc(doc(favoritesRef, business.id), {
          ...business,
          ownerId: user.uid,
          migratedFromGuest: true,
          savedAt: business.savedAt || Date.now(),
          syncedAt: serverTimestamp(),
        }, { merge: true })),
        ...guestRecent.map((business) => setDoc(doc(recentRef, business.id), {
          ...business,
          ownerId: user.uid,
          lastContactedAt: business.lastContactedAt || Date.now(),
          syncedAt: serverTimestamp(),
        }, { merge: true })),
      ]).then(() => {
        localStorage.removeItem(GUEST_FAVORITES_KEY);
        localStorage.removeItem(GUEST_RECENT_KEY);
      }).catch((error) => {
        console.error('Guest data migration failed; local data was retained', error);
        syncingGuestData.current = false;
      });
    }

    return () => {
      unsubFavorites();
      unsubRecent();
    };
  }, [firestore, user]);

  const addFavorite = async (business: FavoriteBusiness) => {
    if (!business.id) return;
    const normalized = { ...business, savedAt: business.savedAt || Date.now() };

    if (!user) {
      setFavorites((prev) => {
        const next = mergeBusinesses([normalized, ...prev]);
        writeLocal(GUEST_FAVORITES_KEY, next);
        return next;
      });
      return;
    }

    await setDoc(doc(firestore, 'users', user.uid, 'favorites', business.id), {
      ...normalized,
      ownerId: user.uid,
      syncedAt: serverTimestamp(),
    }, { merge: true });
  };

  const removeFavorite = async (businessId: string) => {
    if (!user) {
      setFavorites((prev) => {
        const next = prev.filter((business) => business.id !== businessId);
        writeLocal(GUEST_FAVORITES_KEY, next);
        return next;
      });
      return;
    }

    await deleteDoc(doc(firestore, 'users', user.uid, 'favorites', businessId));
  };

  const recordContact = async (business: FavoriteBusiness) => {
    if (!business.id) return;
    const normalized = { ...business, lastContactedAt: Date.now() };

    if (!user) {
      setRecentlyContacted((prev) => {
        const next = mergeBusinesses([normalized, ...prev]);
        writeLocal(GUEST_RECENT_KEY, next);
        return next;
      });
      return;
    }

    await setDoc(doc(firestore, 'users', user.uid, 'recentBusinesses', business.id), {
      ...normalized,
      ownerId: user.uid,
      syncedAt: serverTimestamp(),
    }, { merge: true });
  };

  return (
    <FavoritesContext.Provider value={{
      favorites,
      recentlyContacted,
      addFavorite,
      removeFavorite,
      isFavorite: (businessId) => favorites.some((business) => business.id === businessId),
      recordContact,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used within a FavoritesProvider');
  return context;
};

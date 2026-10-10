
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc } from "firebase/firestore";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';

export interface UserProfile {
    uid: string;
    email: string;
    businessName: string;
    fullName?: string;
    role: string;
    /** True until the user completes the post-sign-in role selection step. */
    needsRoleSelection?: boolean;
    roleSelectionCompleted?: boolean;
    category: string;
    subcategoryId?: string; // Selected subcategory ID from detailed category list
    subcategoryName?: string; // Display name of selected subcategory
    dashboardType?: string; // Type of dashboard layout (services, health, food, etc.)
    address: string;
    city: string;
    state: string;
    countryCode?: string; // ISO country code for location filtering
    latitude?: number; // Business location latitude for proximity search
    longitude?: number; // Business location longitude for proximity search
    createdAt: string; // Keep as string to match what's in Firestore
    isAdmin?: boolean;
    purchaseHistory?: string[];
    ghostCoins?: number;
    currencyCode?: string;
    ghostCoinRewardPerSale?: number;
    ghostCoinMinimumQuantity?: number;
    ghostCoinOfferEnabled?: boolean;
    storefrontWallpaper?: string;
    balance?: number;
    slogan?: string;
    totalItemsPurchased?: number;
    membershipTier?: 'community' | 'basic' | 'plus' | 'pro';
    businessDescription?: string;
    subscriptionPlanId?: string; // Reference to subscription plan
    subscriptionStartDate?: string; // ISO date string
    subscriptionEndDate?: string; // ISO date string
    subscriptionStatus?: 'active' | 'inactive' | 'expired' | 'past_due' | 'cancelled'; // Subscription status
    storageLimitBytes?: number; // Total storage limit in bytes from subscription plan
    usedStorageBytes?: number; // Currently used storage in bytes
    maxListings?: number | null; // Maximum product listings from subscription plan
    maxImages?: number | null; // Maximum active product images from subscription plan
    subscriptionFeatures?: string[];
    subscriptionSource?: 'admin' | 'stripe' | 'system';
    subscriptionGrantedBy?: string | null;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    cancelAtPeriodEnd?: boolean;
    lowStockThreshold?: number;
    pickupEnabled?: boolean;
    deliveryEnabled?: boolean;
    deliveryBaseFee?: number;
    deliveryPerKm?: number;
    deliveryFreeAbove?: number;
    maxDeliveryFee?: number;
    permissions?: string[];
    currentListings?: number; // Current number of product listings
}

interface AuthContextType {
  user: {
    uid: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string | null;
    getIdToken: (forceRefresh?: boolean) => Promise<string>;
  } | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Use the useDoc hook to get a real-time, memoized user profile from Firestore.
  // This is now the single source of truth for the user's profile.
  const userDocRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null,
    [user, firestore]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

 const loading = !!(isUserLoading || (user && isProfileLoading));

 return (
   <AuthContext.Provider value={{ 
     user: user ?? null, 
     userProfile: userProfile ?? null, 
     loading 
   }}>
     {children}
   </AuthContext.Provider>
 );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

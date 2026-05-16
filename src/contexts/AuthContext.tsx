
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc } from "firebase/firestore";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';

export interface UserProfile {
    uid: string;
    email: string;
    businessName: string;
    fullName?: string;
    role: string;
    category: string;
    subcategoryId?: string; // Selected subcategory ID from detailed category list
    subcategoryName?: string; // Display name of selected subcategory
    dashboardType?: string; // Type of dashboard layout (services, health, food, etc.)
    address: string;
    city: string;
    state: string;
    createdAt: string; // Keep as string to match what's in Firestore
    isAdmin?: boolean;
    purchaseHistory?: string[];
    ghostCoins?: number;
    storefrontWallpaper?: string;
    balance?: number;
    slogan?: string;
    totalItemsPurchased?: number;
    membershipTier?: 'community' | 'pro';
    businessDescription?: string;
}

interface AuthContextType {
  user: User | null;
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

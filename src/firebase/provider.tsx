
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import * as firebaseAuth from 'firebase/auth';

type Auth = any;
type User = any;
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import { auth as authInstance, firestore as firestoreInstance, firebaseApp as firebaseAppInstance } from '@/firebase';

// Combined state for the Firebase context
export interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth; 
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const useFirebase = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return context;
};

export const useAuth = (): Auth => useFirebase().auth;
export const useFirestore = (): Firestore => useFirebase().firestore;
export const useFirebaseApp = (): FirebaseApp => useFirebase().firebaseApp;


export interface UserHookResult { 
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}


export const useUser = (): UserHookResult => {
  const [userState, setUserState] = useState<UserHookResult>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    const unsubscribe = (firebaseAuth as any).onAuthStateChanged(
      authInstance,
      (user: User | null) => setUserState({ user, isUserLoading: false, userError: null }),
      (error: Error) => setUserState({ user: null, isUserLoading: false, userError: error })
    );

    return () => unsubscribe();
  }, []);

  return userState;
};

type MemoFirebase <T> = T & {__memo?: boolean};
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

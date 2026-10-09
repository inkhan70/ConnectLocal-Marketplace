
'use client';
import React, { ReactNode } from 'react';
import { FirebaseContext, FirebaseContextState } from '@/firebase/provider';
import { firebaseApp, auth, firestore } from '@/firebase';

interface FirebaseProviderProps {
    children: ReactNode;
}

const firebaseContextValue: FirebaseContextState = {
    firebaseApp,
    auth,
    firestore,
};

export function FirebaseProvider({ children }: FirebaseProviderProps) {
    return (
        <FirebaseContext.Provider value={firebaseContextValue}>
            {children}
        </FirebaseContext.Provider>
    );
}

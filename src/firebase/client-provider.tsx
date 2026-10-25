
'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider } from '@/contexts/FirebaseContext';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  return (
    <FirebaseProvider>
      {children}
    </FirebaseProvider>
  );
}

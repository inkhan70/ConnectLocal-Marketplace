'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Friendly fallback for any unexpected screen error (replaces the bare "Application error" page). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Screen error:', error); }, [error]);
  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold font-headline">Something went wrong on this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">Please try again. If the problem continues, go back to the home page or contact support.</p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild><Link href="/">Home</Link></Button>
      </div>
    </div>
  );
}

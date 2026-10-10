
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase';
import * as firebaseAuth from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const auth = useAuth();
  
  const mode = searchParams.get('mode');
  const actionCode = searchParams.get('oobCode');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email, please wait...');

  useEffect(() => {
    if (mode !== 'verifyEmail' || !actionCode) {
      router.push('/');
      return;
    }

    const handleVerifyEmail = async () => {
      try {
        // First, check if the code is valid.
        await (firebaseAuth as any).checkActionCode(auth, actionCode);
        
        // If valid, apply the code to verify the email.
        await (firebaseAuth as any).applyActionCode(auth, actionCode);
        
        setStatus('success');
        setMessage('Your email has been successfully verified! You can now sign in.');
        toast({
          title: 'Email Verified',
          description: 'You may now sign in with your credentials.',
        });

      } catch (error: any) {
        setStatus('error');
        let errorMessage = 'An unknown error occurred. The link may be expired or invalid.';
        if (error.code === 'auth/invalid-action-code') {
          errorMessage = 'The verification link is invalid or has already been used. Please sign up again or request a new verification email.';
        }
        setMessage(errorMessage);
        toast({
          title: 'Verification Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    };

    handleVerifyEmail();
  }, [mode, actionCode, auth, router, toast]);

  return (
    <div className="container flex min-h-[calc(100vh-14rem)] items-center justify-center py-12">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">Email Verification</CardTitle>
          <CardDescription>
            Finalizing your account setup.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">{message}</p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="text-muted-foreground">{message}</p>
              <Button asChild className="mt-4">
                <Link href="/signin">Go to Sign In</Link>
              </Button>
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-destructive">{message}</p>
               <Button asChild variant="secondary" className="mt-4">
                <Link href="/signup">Back to Sign Up</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <VerifyEmailContent />
        </Suspense>
    )
}

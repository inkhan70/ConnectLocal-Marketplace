'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function AdminSetupPage() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [setupKey, setSetupKey] = useState('');

  const handleMakeAdmin = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be signed in first',
        variant: 'destructive',
      });
      return;
    }

    if (!user.email) {
      toast({ title: 'Error', description: 'Your account has no email address.', variant: 'destructive' });
      return;
    }
    if (!setupKey.trim()) {
      toast({ title: 'Error', description: 'Enter the administrator setup key.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      // The key is verified on the server against ADMIN_SETUP_KEY. It must never be compared in the browser,
      // and Firestore rules deliberately forbid clients from setting isAdmin themselves.
      const response = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${setupKey.trim()}` },
        body: JSON.stringify({ email: user.email, setAdmin: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to set admin status');

      toast({
        title: 'Success',
        description: 'Your account has been set as admin. Signing you in again to refresh your permissions.',
      });

      // Custom claims are only picked up on a fresh ID token, so force a refresh before navigating.
      try { await (user as any).getIdToken(true); } catch {}
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1500);
    } catch (error: any) {
      console.error('Error setting admin:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to set admin status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto my-8 flex justify-center items-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Setup</CardTitle>
          <CardDescription>
            Configure admin access for your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">Current User</Label>
            <p className="text-sm text-muted-foreground">
              {user?.email || 'Not logged in'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Admin Status: {userProfile?.isAdmin ? '✓ Admin' : '✗ Not Admin'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="setupKey">Admin Setup Key</Label>
            <Input
              id="setupKey"
              type="password"
              placeholder="Enter setup key"
              value={setupKey}
              onChange={(e) => setSetupKey(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Setup key required for security
            </p>
          </div>

          <Button
            onClick={handleMakeAdmin}
            disabled={isLoading || !user || userProfile?.isAdmin}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting Admin...
              </>
            ) : userProfile?.isAdmin ? (
              'Already Admin'
            ) : (
              'Make Admin'
            )}
          </Button>

          {userProfile?.isAdmin && (
            <div className="bg-green-50 text-green-800 text-sm p-3 rounded-md">
              Your account is already set as admin. You can access the admin dashboard.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

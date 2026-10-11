"use client";

import { useEffect, useState } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Wallet, Gem } from "lucide-react";

export function BuyerDashboard() {
    const { userProfile, user } = useAuth();
    const { toast } = useToast();
    const [isConverting, setIsConverting] = useState(false);
    const [rate, setRate] = useState<{currency:string; localCoinValue:number|null; configured:boolean; countryCode?:string; countryName?:string; locationSource?:string; usdValue?:number}>({ currency: 'USD', localCoinValue: null, configured: false });

    useEffect(() => {
        if (!user) return;
        user.getIdToken().then(token => fetch('/api/rewards/rate', { headers: { Authorization: `Bearer ${token}` } }))
            .then(r => r.json()).then(data => { if (data.currency) setRate(data); }).catch(() => {});
    }, [user]);

    const coins = Math.max(0, Math.floor(userProfile?.ghostCoins || 0));
    const estimated = rate.localCoinValue == null ? null : Math.round(coins * rate.localCoinValue * 100) / 100;
    const formatMoney = (value: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: rate.currency }).format(value);
    const locationLabel = rate.countryName || rate.countryCode || 'your detected region';

    const handleConvertCoins = async () => {
        if (!user || coins <= 0) { toast({ title: "No coins to convert.", variant: "destructive" }); return; }
        setIsConverting(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/rewards/convert', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ currencyCode: rate.currency }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Conversion failed.');
            toast({ title: 'Conversion Successful!', description: `${data.coins} Ghost Coins converted to ${formatMoney(data.localValue)}.` });
        } catch (e: any) {
            toast({ title: 'Conversion Failed', description: e.message || 'There was an error converting your coins.', variant: 'destructive' });
        } finally { setIsConverting(false); }
    };

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold font-headline">Buyer Dashboard</h1><p className="text-muted-foreground">An overview of your account, balance and seller rewards.</p></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Account Balance</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(Number(userProfile?.balance || 0))}</div><p className="text-xs text-muted-foreground">Available for your next purchase.</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ghost Coins</CardTitle><Gem className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{coins}</div><p className="text-xs text-muted-foreground">Estimated value in {rate.currency}: <span className="font-semibold">{estimated == null ? 'Rate unavailable' : formatMoney(estimated)}</span></p></CardContent></Card>
            </div>
            <Card><CardHeader><CardTitle>Ghost Coin Conversion</CardTitle><CardDescription>Seller offers are credited after a qualifying order is completed. Each Ghost Coin is worth 10 PKR. The app converts 10 PKR → USD using the latest available USD/PKR rate, then USD → your IP-detected local currency.</CardDescription></CardHeader><CardContent><p className="mb-2">{rate.configured && rate.localCoinValue != null ? `1 Ghost Coin ≈ ${formatMoney(rate.localCoinValue)}` : 'A local exchange rate is currently unavailable.'}</p><p className="mb-4 text-xs text-muted-foreground">Currency: {rate.currency} · Region: {locationLabel} · Detection: {rate.locationSource === 'ipapi' || rate.locationSource === 'ip-header' ? 'IP-based' : 'profile fallback'}</p><Button onClick={handleConvertCoins} disabled={isConverting || coins <= 0 || !rate.configured}>{isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Convert to {rate.currency} Credit</Button></CardContent></Card>
        </div>
    );
}

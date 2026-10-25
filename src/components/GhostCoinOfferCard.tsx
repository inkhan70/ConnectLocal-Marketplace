"use client";

import { useState } from "react";
import { Gem, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export function GhostCoinOfferCard() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [rewardCoins, setRewardCoins] = useState(Math.max(0, Math.floor(userProfile?.ghostCoinRewardPerSale || 0)));
  const [minimumQuantity, setMinimumQuantity] = useState(Math.max(1, Math.floor(userProfile?.ghostCoinMinimumQuantity || 1)));
  const [enabled, setEnabled] = useState(userProfile?.ghostCoinOfferEnabled === true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/rewards/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ghostCoinRewardPerSale: rewardCoins, ghostCoinMinimumQuantity: minimumQuantity, ghostCoinOfferEnabled: enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save offer.");
      toast({ title: "Ghost Coin offer saved", description: enabled ? `${rewardCoins} Ghost Coins on qualifying completed sales.` : "Ghost Coin rewards are disabled." });
    } catch (error: any) {
      toast({ title: "Could not save reward offer", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gem className="h-5 w-5" />Ghost Coin Offer</CardTitle>
        <CardDescription>Set the reward you fund for buyers. The offer is locked into each order at checkout and credited only after completion.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div><label className="text-sm font-medium">Coins per completed sale</label><input className="mt-1 w-full rounded-md border bg-background px-3 py-2" type="number" min="0" step="1" value={rewardCoins} onChange={e => setRewardCoins(Math.max(0, Math.floor(Number(e.target.value || 0))))} /></div>
          <div><label className="text-sm font-medium">Minimum items in order</label><input className="mt-1 w-full rounded-md border bg-background px-3 py-2" type="number" min="1" step="1" value={minimumQuantity} onChange={e => setMinimumQuantity(Math.max(1, Math.floor(Number(e.target.value || 1))))} /><p className="mt-1 text-xs text-muted-foreground">Example: 1,000 items + 5 coins.</p></div>
          <div className="flex items-end gap-3 pb-2"><input id="ghost-offer-enabled" type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-4 w-4" /><label htmlFor="ghost-offer-enabled" className="text-sm font-medium">Offer enabled</label></div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-md bg-muted p-3 text-sm"><span>{enabled ? `Qualifying buyers receive ${rewardCoins} Ghost Coins when the order is completed.` : "Ghost Coin rewards are disabled for your store."}</span><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Offer</Button></div>
      </CardContent>
    </Card>
  );
}

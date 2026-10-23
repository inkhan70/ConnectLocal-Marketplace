"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export function BusinessShareCard() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isBusiness = Boolean(userProfile?.role && userProfile.role !== "buyer");
  const businessName = userProfile?.businessName || userProfile?.fullName || "My ConnectLocal business";
  const shortUrl = useMemo(() => {
    if (typeof window === "undefined" || !user?.uid) return "";
    return `${window.location.origin}/b/${user.uid}`;
  }, [user?.uid]);
  const shareText = `Visit ${businessName} on ConnectLocal: ${shortUrl}`;

  if (!user || !isBusiness || !shortUrl) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      toast({ title: "Business link copied", description: "You can paste the short link anywhere." });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Could not copy link", description: shortUrl, variant: "destructive" });
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) {
      setOpen(true);
      return;
    }
    try {
      await navigator.share({ title: businessName, text: `Visit ${businessName} on ConnectLocal`, url: shortUrl });
    } catch (error: any) {
      if (error?.name !== "AbortError") setOpen(true);
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  // Messenger's app deep link opens the installed app when supported. The Web Share
  // button remains available as a browser fallback because Messenger does not expose
  // a recipient-independent web share endpoint without a Meta app id.
  const messengerUrl = `fb-messenger://share/?link=${encodeURIComponent(shortUrl)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(`Visit ${businessName} on ConnectLocal`)}&body=${encodeURIComponent(shareText)}`;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Share2 className="h-5 w-5" /> Share your business</CardTitle>
          <CardDescription>Send your short ConnectLocal business link to customers through WhatsApp, Messenger, email, or any other app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate text-sm">{shortUrl}</code>
            <Button type="button" variant="outline" size="sm" onClick={copyLink}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={nativeShare}><Share2 className="mr-2 h-4 w-4" />Share</Button>
            <Button type="button" variant="outline" asChild><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a></Button>
            <Button type="button" variant="outline" asChild><a href={messengerUrl}><MessageCircle className="mr-2 h-4 w-4" />Messenger</a></Button>
            <Button type="button" variant="outline" asChild><a href={emailUrl}><Mail className="mr-2 h-4 w-4" />Email</a></Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(true)}>More options</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {businessName}</DialogTitle>
            <DialogDescription>Choose how you want to send your short business link.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" asChild><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a></Button>
            <Button variant="outline" asChild><a href={messengerUrl}><MessageCircle className="mr-2 h-4 w-4" />Messenger app</a></Button>
            <Button variant="outline" asChild><a href={emailUrl}><Mail className="mr-2 h-4 w-4" />Email</a></Button>
            <Button variant="outline" onClick={copyLink}><Copy className="mr-2 h-4 w-4" />Copy short link</Button>
          </div>
          <DialogFooter><Button variant="secondary" onClick={nativeShare}>Use device share</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

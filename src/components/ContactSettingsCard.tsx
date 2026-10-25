"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { MessageCircle, Phone, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhone, normalizePhone, whatsappUrl } from "@/lib/contact";

/**
 * Where customers reach the member: WhatsApp and phone (call / SMS). Numbers are checked and stored in international
 * format (+923001234567) so the buttons on the storefront and product pages open the right chat every time.
 */
export function ContactSettingsCard() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWhatsapp(userProfile?.contactWhatsapp || "");
    setPhone(userProfile?.contactPhone || "");
  }, [userProfile?.contactWhatsapp, userProfile?.contactPhone]);

  const cc = userProfile?.countryCode;
  const wa = whatsapp.trim() ? normalizePhone(whatsapp, cc) : null;
  const ph = phone.trim() ? normalizePhone(phone, cc) : null;

  async function save() {
    if (!user) return;
    if ((wa && !wa.ok) || (ph && !ph.ok)) {
      toast({ title: "Check your numbers", description: (wa && !wa.ok ? wa.error : ph?.error) || "Invalid number.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(firestore, "users", user.uid), {
        contactWhatsapp: wa?.ok ? wa.e164 : deleteField(),
        contactPhone: ph?.ok ? ph.e164 : deleteField(),
      });
      toast({ title: "Contact details saved", description: "Customers can now reach you from your storefront and listings." });
    } catch (error: any) {
      console.error("Saving contact details failed:", error);
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Contact</CardTitle>
        <CardDescription>
          Customers tap WhatsApp, Call or SMS on your storefront and listings and reach this exact number. These numbers are shown publicly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-whatsapp" className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp number</Label>
            <Input id="contact-whatsapp" inputMode="tel" autoComplete="tel" placeholder="+92 300 1234567" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            {wa && (wa.ok
              ? <p className="text-xs text-muted-foreground">Customers will chat with <strong>{formatPhone(wa.e164!)}</strong></p>
              : <p className="text-xs text-destructive">{wa.error}</p>)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone" className="flex items-center gap-2"><Phone className="h-4 w-4" /> Phone for calls &amp; SMS (optional)</Label>
            <Input id="contact-phone" inputMode="tel" autoComplete="tel" placeholder="Leave empty to use your WhatsApp number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {ph && (ph.ok
              ? <p className="text-xs text-muted-foreground">Customers will call <strong>{formatPhone(ph.e164!)}</strong></p>
              : <p className="text-xs text-destructive">{ph.error}</p>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save contact details</Button>
          {wa?.ok && (
            <Button type="button" variant="outline" asChild>
              <a href={whatsappUrl(wa.digits!, "Test message from my ConnectLocal storefront")} target="_blank" rel="noopener noreferrer">Test WhatsApp link</a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

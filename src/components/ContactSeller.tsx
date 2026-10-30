"use client";

import { MessageCircle, Phone, MessageSquare, Send, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { getSellerContact, smsUrl, telUrl, whatsappUrl } from "@/lib/contact";

interface Props {
  /** Public seller profile (contact numbers are already validated by the server). */
  seller: { contactWhatsapp?: string; contactPhone?: string; countryCode?: string; businessName?: string } | null | undefined;
  /** Pre-filled opening message, e.g. "Hello, I am interested in <product>". */
  message?: string;
  /** Authenticated member id for the dedicated ConnectLocal conversation button. */
  targetMemberId?: string;
  /** Shown when the seller published no number (e.g. open the in-app chat). */
  fallback?: { label: string; onClick: () => void };
  /** Render nothing (instead of a notice) when there is no number to use. */
  hideWhenEmpty?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}

/**
 * One-tap contact: WhatsApp (opens the seller's chat with a ready message), Call and SMS. Works for signed-in users
 * and guests, on phones (opens the WhatsApp app) and desktop (WhatsApp Web).
 */
export function ContactSeller({ seller, message, targetMemberId, fallback, hideWhenEmpty, size = "default", className }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startingChat, setStartingChat] = useState(false);
  const { whatsapp, phone } = getSellerContact(seller);
  async function startConnectLocalChat() {
    if (!targetMemberId) return fallback?.onClick();
    if (!user) {
      toast({ title: "Sign in to message", description: "Create an account or sign in to use ConnectLocal messaging.", variant: "destructive" });
      return;
    }
    setStartingChat(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/chats", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetId: targetMemberId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start conversation.");
      window.location.assign(`/dashboard/chat?chatId=${encodeURIComponent(data.chatId)}`);
    } catch (error: any) {
      toast({ title: "Could not start conversation", description: error.message, variant: "destructive" });
    } finally { setStartingChat(false); }
  }
  const text = message || `Hello${seller?.businessName ? ` ${seller.businessName}` : ""}, I found you on ConnectLocal.`;

  if (!whatsapp && !phone) {
    if (hideWhenEmpty && !fallback && !targetMemberId) return null;
    return (
      <div className={`flex flex-wrap gap-2 ${className || ""}`}>
        {targetMemberId && <Button type="button" variant="default" size={size} onClick={startConnectLocalChat} disabled={startingChat} aria-label="Message on ConnectLocal">{startingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Message on ConnectLocal</Button>}
        {!targetMemberId && fallback && <Button type="button" variant="outline" size={size} onClick={fallback.onClick}><MessageSquare className="mr-2 h-4 w-4" /> {fallback.label}</Button>}
        {!targetMemberId && !fallback && <p className="text-sm text-muted-foreground">This seller has not added contact details yet.</p>}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className || ""}`}>
      {targetMemberId && (
        <Button type="button" size={size} onClick={startConnectLocalChat} disabled={startingChat} aria-label="Message on ConnectLocal">
          {startingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {startingChat ? "Opening…" : "Message"}
        </Button>
      )}
      {whatsapp && (
        <Button asChild size={size} className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
          <a href={whatsappUrl(whatsapp, text)} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </a>
        </Button>
      )}
      {phone && (
        <Button asChild size={size} variant="outline">
          <a href={telUrl(phone)} aria-label="Call the seller"><Phone className="mr-2 h-4 w-4" /> Call</a>
        </Button>
      )}
      {phone && (
        <Button asChild size={size} variant="outline">
          <a href={smsUrl(phone, text)} aria-label="Send an SMS"><MessageSquare className="mr-2 h-4 w-4" /> SMS</a>
        </Button>
      )}
    </div>
  );
}

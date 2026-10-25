"use client";

import { MessageCircle, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSellerContact, smsUrl, telUrl, whatsappUrl } from "@/lib/contact";

interface Props {
  /** Public seller profile (contact numbers are already validated by the server). */
  seller: { contactWhatsapp?: string; contactPhone?: string; countryCode?: string; businessName?: string } | null | undefined;
  /** Pre-filled opening message, e.g. "Hello, I am interested in <product>". */
  message?: string;
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
export function ContactSeller({ seller, message, fallback, hideWhenEmpty, size = "default", className }: Props) {
  const { whatsapp, phone } = getSellerContact(seller);
  const text = message || `Hello${seller?.businessName ? ` ${seller.businessName}` : ""}, I found you on ConnectLocal.`;

  if (!whatsapp && !phone) {
    if (hideWhenEmpty && !fallback) return null;
    return fallback ? (
      <Button type="button" variant="outline" size={size} className={className} onClick={fallback.onClick}>
        <MessageSquare className="mr-2 h-4 w-4" /> {fallback.label}
      </Button>
    ) : (
      <p className="text-sm text-muted-foreground">This seller has not added contact details yet.</p>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className || ""}`}>
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

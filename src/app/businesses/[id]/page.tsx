"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MapPin, Navigation, Stethoscope, Store, Heart, MessageSquare } from "lucide-react";
import { collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { usePublicBusiness } from "@/hooks/use-public-business";
import { ContactSeller } from "@/components/ContactSeller";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import images from "@/app/lib/placeholder-images.json";
import type { UserProfile } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function BusinessProfilePage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const { addFavorite, removeFavorite, isFavorite, recordContact } = useFavorites();
  const { data: publicProfile, isLoading } = usePublicBusiness(params?.id);
  const profile = publicProfile as UserProfile | null;
  const productsQuery = useMemoFirebase(
    () => profile?.uid ? query(collection(firestore, "products"), where("userId", "==", profile.uid)) : null,
    [firestore, profile?.uid],
  );
  const { data: products, isLoading: productsLoading } = useCollection<any>(productsQuery);

  if (isLoading) {
    return <div className="container mx-auto px-4 py-16 text-center">Loading profile…</div>;
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Provider not found</h1>
        <Button asChild className="mt-6"><Link href="/categories">Back to categories</Link></Button>
      </div>
    );
  }

  const isDoctor = profile.subcategoryId === "health_doctor";

  const favorite = profile ? isFavorite(profile.uid) : false;

  const handleToggleFavorite = async () => {
    if (!profile) return;
    const data = {
      id: profile.uid,
      name: profile.businessName || profile.fullName || "Provider",
      address: [profile.address, profile.city, profile.state].filter(Boolean).join(", "),
      image: profile.storefrontWallpaper || images.businesses.corner_store,
      dataAiHint: isDoctor ? "medical provider" : "storefront",
      category: profile.category,
      role: profile.role,
    };
    try {
      if (favorite) await removeFavorite(profile.uid);
      else await addFavorite(data);
    } catch (error) {
      console.error("Failed to update saved business", error);
      toast({ title: "Could not update saved business", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleStartChat = async () => {
    if (!user || !userProfile || !profile) {
      toast({ title: "Please sign in", description: "Sign in to contact this business.", variant: "destructive" });
      return;
    }
    if (user.uid === profile.uid) return;
    try {
      const chatsRef = collection(firestore, "chats");
      const snapshot = await getDocs(query(chatsRef, where("participants", "array-contains", user.uid)));
      const existing = snapshot.docs.find((item) => {
        const participants = item.data().participants;
        return Array.isArray(participants) && participants.includes(profile.uid);
      });

      await recordContact({
        id: profile.uid,
        name: profile.businessName || profile.fullName || "Provider",
        address: [profile.address, profile.city, profile.state].filter(Boolean).join(", "),
        image: profile.storefrontWallpaper || images.businesses.corner_store,
        dataAiHint: isDoctor ? "medical provider" : "storefront",
        category: profile.category,
        role: profile.role,
      });

      if (existing) {
        router.push(`/dashboard/chat?chatId=${existing.id}`);
        return;
      }

      const newChat = await addDoc(chatsRef, {
        participants: [user.uid, profile.uid],
        participantProfiles: {
          [user.uid]: { name: userProfile.fullName || userProfile.businessName || "User", role: userProfile.role },
          [profile.uid]: { name: profile.businessName || profile.fullName || "Business", role: profile.role },
        },
        lastMessage: "Chat started...",
        lastMessageTimestamp: serverTimestamp(),
      });
      router.push(`/dashboard/chat?chatId=${newChat.id}`);
    } catch (error) {
      console.error("Failed to start business chat", error);
      toast({ title: "Could not contact business", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <Button variant="ghost" asChild className="mb-6">
        <Link href={`/businesses?category=${encodeURIComponent(profile.category?.toLowerCase() || "medical")}&role=${encodeURIComponent(profile.role)}&subcategory=${encodeURIComponent(profile.subcategoryId || "")}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to nearby results
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {isDoctor ? <Stethoscope className="h-8 w-8 text-primary" /> : <Store className="h-8 w-8 text-primary" />}
            <div>
              <CardTitle className="text-3xl">{profile.businessName || profile.fullName || "Provider"}</CardTitle>
              {profile.subcategoryName && <p className="text-muted-foreground mt-1">{profile.subcategoryName}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleToggleFavorite} aria-label={favorite ? "Remove saved business" : "Save business"}>
                <Heart className={cn("mr-2 h-4 w-4", favorite && "fill-red-500 text-red-500")} />
                {favorite ? "Saved" : "Save"}
              </Button>
              {(!user || user.uid !== profile.uid) && (
                <ContactSeller
                  seller={profile}
                  message={`Hello ${profile.businessName || ''}, I found your business on ConnectLocal and would like to know more.`}
                  fallback={user ? { label: "Message", onClick: handleStartChat } : undefined}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Image src={profile.storefrontWallpaper || images.businesses.corner_store} alt={`${profile.businessName || profile.fullName || "Provider"} storefront`} width={900} height={360} className="h-56 w-full rounded-lg object-cover" />
          {profile.businessDescription && <p>{profile.businessDescription}</p>}
          <div className="rounded-lg border bg-muted/30 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Storefront products</h2>
                <p className="text-sm text-muted-foreground">Browse products published by this business.</p>
              </div>
              <Button asChild>
                <Link href={`/products/distributor/${encodeURIComponent(profile.uid)}`}>View storefront</Link>
              </Button>
            </div>
            {productsLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading products…</p> : products?.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {products.slice(0, 4).map((product: any) => (
                  <Link key={product.id} href={`/products/item/${encodeURIComponent(product.id)}`} className="rounded-md border bg-background p-3 transition-colors hover:border-primary">
                    <p className="font-medium">{product.name || "Product"}</p>
                    {product.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>}
                  </Link>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-muted-foreground">This business has not published products yet.</p>}
          </div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{[profile.address, profile.city, profile.state].filter(Boolean).join(", ") || "Location unavailable"}</span>
          </div>
          {profile.latitude != null && profile.longitude != null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Navigation className="h-4 w-4" /> Provider location is available for proximity search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

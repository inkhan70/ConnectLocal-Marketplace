
"use client"

import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Loader2, Package, MessageSquare, Heart } from "lucide-react";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import images from '@/app/lib/placeholder-images.json';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { ProductSearch } from "@/components/ProductSearch";
import { useAuth, UserProfile } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useFavorites, FavoriteBusiness } from "@/contexts/FavoritesContext";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface Variety {
    id: string;
    name: string;
    price: number;
    image?: string;
    dataAiHint?: string;
}

interface Product {
    id: string;
    name: string;
    varieties: Variety[];
}

export default function DistributorInventoryPage({ params }: { params: { id: string } }) {
  const { t } = useLanguage();
  const firestore = useFirestore();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  const businessId = params.id;

  const businessDocRef = useMemoFirebase(() => doc(firestore, "users", businessId), [firestore, businessId]);
  const { data: business, isLoading: businessLoading } = useDoc<UserProfile>(businessDocRef);

  const productsQuery = useMemoFirebase(() => query(collection(firestore, "products"), where("userId", "==", businessId)), [firestore, businessId]);
  const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);

  const isLoading = businessLoading || productsLoading;
  const favorite = business ? isFavorite(business.uid) : false;

  const handleStartChat = async () => {
    if (!user || !userProfile || !business) {
      toast({ title: "Please sign in", description: "You need to be logged in to start a chat.", variant: "destructive"});
      return;
    }
    if (user.uid === business.uid) {
      toast({ title: "Cannot chat with yourself", description: "You cannot start a chat with your own business.", variant: "destructive"});
      return;
    }

    try {
      const chatsRef = collection(firestore, "chats");
      const q = query(chatsRef, where('participants', 'array-contains', user.uid));
      const querySnapshot = await getDocs(q);
      
      let existingChatId: string | null = null;
      // Using chatSnap to avoid shadowing the 'doc' import from Firestore
      for (const chatSnap of querySnapshot.docs) {
          const chatData = chatSnap.data();
          if (chatData.participants.includes(business.uid)) {
              existingChatId = chatSnap.id;
              break;
          }
      }

      if (existingChatId) {
        router.push(`/dashboard/chat?chatId=${existingChatId}`);
        return;
      }

      const businessUserDoc = await getDocs(query(collection(firestore, "users"), where("uid", "==", business.uid)));
      const businessUserProfile = businessUserDoc.docs[0]?.data() as UserProfile | undefined;

      if (!businessUserProfile) {
          throw new Error("Could not find business owner's profile.");
      }

      const newChatRef = await addDoc(chatsRef, {
        participants: [user.uid, business.uid],
        participantProfiles: {
          [user.uid]: { 
              name: userProfile.fullName || userProfile.businessName || "User", 
              role: userProfile.role 
          },
          [business.uid]: { 
              name: businessUserProfile.businessName || "Business", 
              role: businessUserProfile.role 
          },
        },
        lastMessage: "Chat started...",
        lastMessageTimestamp: serverTimestamp(),
      });

      router.push(`/dashboard/chat?chatId=${newChatRef.id}`);

    } catch (error) {
      console.error("Error starting chat:", error);
      toast({ title: "Error", description: "Could not start chat.", variant: "destructive" });
    }
  };
  
  const handleToggleFavorite = () => {
    if (!business) return;
    const favData: FavoriteBusiness = {
        id: business.uid,
        name: business.businessName,
        address: business.address,
        image: business.storefrontWallpaper || images.businesses.corner_store,
        dataAiHint: 'storefront'
    };
    favorite ? removeFavorite(business.uid) : addFavorite(favData);
  }

  if (isLoading) {
    return (
        <div className="container mx-auto px-4 py-12 flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  if (!business) {
    return <div className="container mx-auto px-4 py-12 text-center">Business not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {business.storefrontWallpaper && (
         <div className="relative h-64 md:h-80 w-full">
            <Image
                src={business.storefrontWallpaper}
                alt={`${business.businessName} storefront`}
                fill
                className="object-cover"
                priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
         </div>
      )}
      <div className="container mx-auto px-4 pb-12">
        <div className={cn("p-4 md:p-6 rounded-lg -mt-16 md:-mt-24 relative z-10", !business.storefrontWallpaper && "pt-12 mt-0")}>
          <div className="flex flex-col sm:flex-row justify-between sm:items-start bg-background/80 backdrop-blur-sm p-4 rounded-lg shadow-lg">
              <div>
                  <h1 className="text-4xl md:text-5xl font-extrabold font-headline leading-tight tracking-tighter">
                    {business.businessName}
                  </h1>
                  {business.slogan && <p className="text-xl italic text-muted-foreground mt-2">"{business.slogan}"</p>}
                  <p className="flex items-center text-lg text-muted-foreground mt-2">
                      <MapPin className="h-5 w-5 mr-2" />
                      {business.address}
                  </p>
              </div>
               <div className="flex items-center gap-2 mt-4 sm:mt-0 p-2 rounded-lg">
                    <Button variant="outline" onClick={handleToggleFavorite}>
                        <Heart className={cn("mr-2 h-5 w-5", favorite ? "fill-red-500 text-red-500" : "")} /> 
                        {favorite ? "Favorited" : "Favorite"}
                    </Button>
                    {user && user.uid !== business.uid && (
                        <Button variant="outline" onClick={handleStartChat}>
                            <MessageSquare className="mr-2 h-5 w-5" /> Chat
                        </Button>
                    )}
               </div>
          </div>

           {business.businessDescription && (
                <div className="mt-8 max-w-4xl bg-card border rounded-lg p-6">
                    <h2 className="text-2xl font-bold font-headline mb-2">About Us</h2>
                    <p className="text-muted-foreground whitespace-pre-wrap">{business.businessDescription}</p>
                </div>
            )}
        </div>

        <Separator className="my-8" />

        <div className="mb-8">
          <ProductSearch placeholder={t('distributor_inventory.search_placeholder')} />
        </div>

        {products && products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="flex flex-col overflow-hidden group transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <CardHeader className="p-0">
                  <div className="relative h-48 w-full">
                    <Image 
                        src={product.varieties?.[0]?.image || images.products.generic} 
                        alt={product.name}
                        fill
                        className="object-cover"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-grow">
                    <CardTitle className="line-clamp-1">{product.name}</CardTitle>
                    <CardDescription className="mt-2">
                        {product.varieties?.length || 0} {t('distributor_inventory.varieties')}
                    </CardDescription>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                    <Button asChild className="w-full">
                        <Link href={`/products/item/${product.id}`}>{t('common.view_details')}</Link>
                    </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <Package className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <h3 className="mt-4 text-lg font-medium">{t('distributor_inventory.no_products')}</h3>
          </div>
        )}
      </div>
    </div>
  );
}

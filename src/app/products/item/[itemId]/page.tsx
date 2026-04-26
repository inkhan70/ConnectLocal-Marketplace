
"use client"

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Minus, Plus, ShoppingCart, Share2, Star, MessageSquare, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import images from '@/app/lib/placeholder-images.json';
import { useAuth, UserProfile } from '@/contexts/AuthContext';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, doc, getDocs } from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';

interface Variety {
  id: string;
  name: string;
  price: number;
  image?: string;
  dataAiHint?: string;
  manufacturer?: string; 
}

interface Product {
  id: string;
  name: string;
  userId: string;
  varieties: Variety[];
}

interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: {
    toDate: () => Date;
  };
}

export default function ItemDetailPage({ params }: { params: { itemId: string } }) {
  const [selectedVariety, setSelectedVariety] = useState<Variety | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const productDocRef = useMemoFirebase(() => doc(firestore, `products/${params.itemId}`), [firestore, params.itemId]);
  const { data: product, isLoading: productLoading, error: productError } = useDoc<Product>(productDocRef);

  const reviewsRef = useMemoFirebase(() => collection(firestore, `products/${params.itemId}/reviews`), [firestore, params.itemId]);
  const { data: reviews, isLoading: reviewsLoading } = useCollection<Review>(reviewsRef);

  useEffect(() => {
    if (product && product.varieties.length > 0 && !selectedVariety) {
      setSelectedVariety(product.varieties[0]);
    }
  }, [product, selectedVariety]);

  const averageRating = reviews && reviews.length > 0
    ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
    : 0;

  const handleAddToCart = () => {
    if (!product || !selectedVariety) return;
    addToCart({
        productId: params.itemId,
        productName: product.name,
        varietyId: selectedVariety.id,
        varietyName: selectedVariety.name,
        price: selectedVariety.price,
        image: selectedVariety.image || images.products.generic,
        quantity: quantity,
        userId: product.userId
    });
    toast({
        title: "Item Added to Cart",
        description: `${quantity} x ${selectedVariety.name} has been added.`
    });
  }
  
  const handleStartChat = async () => {
    if (!user || !userProfile || !product) {
      toast({ title: "Please sign in", description: "You need to be logged in to start a chat.", variant: "destructive"});
      return;
    }
    if (user.uid === product.userId) {
      toast({ title: "Cannot chat with yourself", description: "You cannot start a chat with your own business.", variant: "destructive"});
      return;
    }

    try {
      const chatsRef = collection(firestore, "chats");
      const q = query(chatsRef, where('participants', 'array-contains', user.uid));
      const querySnapshot = await getDocs(q);
      
      let existingChatId: string | null = null;
      for (const chatDoc of querySnapshot.docs) {
          const chatData = chatDoc.data();
          if (chatData.participants.includes(product.userId)) {
              existingChatId = chatDoc.id;
              break;
          }
      }

      if (existingChatId) {
        router.push(`/dashboard/chat?chatId=${existingChatId}`);
        return;
      }
      
      const businessUserDoc = await getDocs(query(collection(firestore, "users"), where("uid", "==", product.userId)));
      const businessUserProfile = businessUserDoc.docs[0]?.data() as UserProfile | undefined;

      if (!businessUserProfile) {
          throw new Error("Could not find business owner's profile.");
      }

      const newChatRef = await addDoc(chatsRef, {
        participants: [user.uid, product.userId],
        participantProfiles: {
          [user.uid]: { name: userProfile.fullName || userProfile.businessName || "User", role: userProfile.role },
          [product.userId]: { name: businessUserProfile.businessName || "Business", role: businessUserProfile.role },
        },
        lastMessage: "Chat started...",
        lastMessageTimestamp: serverTimestamp(),
      });
      router.push(`/dashboard/chat?chatId=${newChatRef.id}`);
      
    } catch (error) {
      console.error("Error starting chat:", error);
      toast({ title: "Error", description: "Could not start chat.", variant: "destructive" });
    }
  }


  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast({
        title: "Link Copied!",
        description: "Product link has been copied to your clipboard.",
      });
    }, (err) => {
      console.error('Could not copy text: ', err);
      toast({
        title: "Failed to Copy",
        description: "Could not copy the link. Please try again.",
        variant: "destructive",
      })
    });
  };
  
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) {
      toast({ title: "Please log in to review.", variant: "destructive" });
      return;
    }
    if (newRating === 0 || !newComment) {
      toast({ title: "Please provide a rating and a comment.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingReview(true);
    try {
      await addDoc(collection(firestore, `products/${params.itemId}/reviews`), {
        productId: params.itemId,
        userId: user.uid,
        userName: userProfile.fullName || userProfile.businessName || "Anonymous",
        rating: newRating,
        comment: newComment,
        createdAt: serverTimestamp()
      });

      toast({ title: "Review Submitted", description: "Thank you for your feedback!" });
      setNewRating(0);
      setNewComment("");
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({ title: "Error submitting review", variant: "destructive" });
    } finally {
      setIsSubmittingReview(false);
    }
  };
  
  if (productLoading) {
      return <div className="container mx-auto px-4 py-12 flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>
  }

  if (productError || !product) {
      return <div className="container mx-auto px-4 py-12 text-center">Product not found or an error occurred.</div>
  }

  if (!selectedVariety) {
      return (
          <div className="container mx-auto px-4 py-12">
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="text-muted-foreground mt-4">This product currently has no varieties available.</p>
          </div>
      )
  }

  return (
    <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-12 mb-12">
            <div>
            <Image src={selectedVariety.image || images.products.generic} alt={selectedVariety.name} width={500} height={500} className="rounded-xl shadow-lg object-cover w-full" data-ai-hint={selectedVariety.dataAiHint || 'product photo'} />
            <div className="mt-4 grid grid-cols-4 gap-2">
                {product.varieties.map(v => (
                    <button key={v.id} onClick={() => setSelectedVariety(v)}>
                        <Image src={v.image || images.varieties.variety_thumb} alt={v.name} width={100} height={100} className={`rounded-md object-cover border-2 ${selectedVariety.id === v.id ? 'border-primary' : 'border-transparent'}`} data-ai-hint={v.dataAiHint || 'product photo'} />
                    </button>
                ))}
            </div>
            </div>

            <div>
            <Card>
                <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-headline text-3xl">{selectedVariety.name}</CardTitle>
                        {selectedVariety.manufacturer && <CardDescription>{t('item_detail.by_manufacturer')} {selectedVariety.manufacturer}</CardDescription>}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{averageRating.toFixed(1)} ({reviews?.length || 0} reviews)</span>
                    </div>
                </div>

                <p className="text-2xl font-bold text-primary pt-2">${selectedVariety.price.toFixed(2)}</p>
                </CardHeader>
                <CardContent>
                <form>
                  <Label>{t('item_detail.select_variety')}</Label>
                  <RadioGroup value={selectedVariety.id} onValueChange={(id) => setSelectedVariety(product.varieties.find(v => v.id === id) || product.varieties[0])} className="mt-2">
                    {product.varieties.map(v => (
                      <div key={v.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={v.id} id={v.id} />
                        <Label htmlFor={v.id} className="cursor-pointer">{v.name}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  
                  <Separator className="my-6" />

                  <div className="flex items-center gap-8">
                      <div>
                        <Label>{t('item_detail.quantity')}</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
                          <Input type="number" value={quantity} readOnly className="w-16 text-center" onChange={e => setQuantity(parseInt(e.target.value) || 1)}/>
                          <Button variant="outline" size="icon" onClick={() => setQuantity(q => q + 1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>
                  </div>

                  <Separator className="my-6" />
                  
                  <div className="flex items-center gap-2">
                    <Button type="button" className="w-full" size="lg" onClick={handleAddToCart}>
                        <ShoppingCart className="mr-2 h-5 w-5" /> {t('item_detail.add_to_cart')}
                    </Button>
                    <Button type="button" variant="outline" size="lg" onClick={handleStartChat}>
                        <MessageSquare className="mr-2 h-5 w-5" /> Chat
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={handleShare}>
                        <Share2 className="h-5 w-5" />
                    </Button>
                  </div>
                </form>
                </CardContent>
            </Card>
            </div>
        </div>
      
        {/* Reviews Section */}
        <div className="max-w-3xl mx-auto">
            <form onSubmit={handleReviewSubmit}>
            <h2 className="text-2xl font-bold font-headline mb-6">Ratings & Reviews</h2>
            
            {/* Review Form */}
            {user && (
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Write a Review</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Your Rating</Label>
                            <div className="flex items-center gap-1 mt-2">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button key={star} type="button" onClick={() => setNewRating(star)}>
                                        <Star className={`h-6 w-6 transition-colors ${newRating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="comment">Your Comment</Label>
                            <Textarea id="comment" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="What did you like or dislike?" />
                        </div>
                        <Button type="submit" disabled={isSubmittingReview}>
                            {isSubmittingReview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Review
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Existing Reviews */}
            <div className="space-y-6">
                {reviewsLoading ? <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div> : 
                reviews && reviews.length > 0 ? reviews.map(review => (
                    <Card key={review.id} className="bg-muted/50">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold">{review.userName}</p>
                                <span className="text-xs text-muted-foreground">{review.createdAt?.toDate().toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1 mb-2">
                                {[1,2,3,4,5].map(star => <Star key={star} className={`h-4 w-4 ${review.rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />)}
                            </div>
                            <p className="text-sm">{review.comment}</p>
                        </CardContent>
                    </Card>
                )) : <p className="text-muted-foreground">No reviews yet. Be the first to leave one!</p>
                }
            </div>
            </form>
        </div>
    </div>
  );
}

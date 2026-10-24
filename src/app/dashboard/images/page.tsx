"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { PlusCircle, Download, AlertTriangle, Loader2 } from "lucide-react";
import Link from 'next/link';
import { useAuth } from "@/contexts/AuthContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";

interface MediaAsset {
  id: string;
  downloadUrl: string;
  categoryName?: string;
  productName?: string;
  productType?: string;
  visibility?: string;
}

interface ImageAsset {
  id: string;
  src: string;
  alt: string;
  category?: string;
}

export default function ProductImagesPage() {
  const { userProfile } = useAuth();
  const firestore = useFirestore();
  const [imageLibrary, setImageLibrary] = useState<ImageAsset[]>([]);

  const userCategory = userProfile?.category;
  const libraryKey = userProfile?.role && userCategory ? `${userProfile.role}:${userCategory.toLowerCase()}` : '';
  const mediaQuery = useMemoFirebase(
    () => libraryKey ? query(collection(firestore, "mediaLibrary"), where("libraryKey", "==", libraryKey)) : null,
    [firestore, libraryKey]
  );
  const { data: mediaAssets, isLoading: loading } = useCollection<MediaAsset>(mediaQuery);

  useEffect(() => {
    if (!mediaAssets) {
      setImageLibrary([]);
      return;
    }
    const unique = new Map<string, ImageAsset>();
    mediaAssets.filter((asset) => asset.visibility !== 'private').forEach((asset) => {
      if (asset.downloadUrl && !unique.has(asset.downloadUrl)) {
        unique.set(asset.downloadUrl, {
          id: asset.id,
          src: asset.downloadUrl,
          alt: asset.productName || asset.productType || 'Product image',
          category: asset.categoryName,
        });
      }
    });
    setImageLibrary(Array.from(unique.values()));
  }, [mediaAssets]);

  const handleDownload = (src: string) => {
    const link = document.createElement('a');
    link.href = src;
    link.download = 'connectlocal-product-image.webp';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-headline">Image Library</h1>
          {userCategory ? (
            <p className="text-muted-foreground">
              Shared product images for <span className="font-semibold text-primary">{userProfile?.role}</span> / <span className="font-semibold text-primary">{userCategory}</span>.
            </p>
          ) : (
            <p className="text-muted-foreground">Manage images for your products and business listings.</p>
          )}
        </div>
        <Button asChild><Link href="/dashboard/products"><PlusCircle className="mr-2 h-4 w-4" /> Add a Product</Link></Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !userCategory ? (
        <Card className="bg-secondary/50 border-dashed"><CardContent className="p-12 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold">No Category Set for Your Profile</h3>
          <p className="text-muted-foreground mt-2 max-w-md">Set a business category before contributing to or browsing the categorized shared image library.</p>
          <Button asChild className="mt-6"><Link href="/dashboard/products"><PlusCircle className="mr-2 h-4 w-4" /> Add a Product</Link></Button>
        </CardContent></Card>
      ) : imageLibrary.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {imageLibrary.map((image) => (
            <Card key={image.id} className="overflow-hidden group">
              <CardContent className="p-0"><Image src={image.src} alt={image.alt} width={400} height={300} className="object-cover w-full h-48" /></CardContent>
              <CardFooter className="p-2 bg-secondary/50 flex items-center justify-between">
                <span className="text-xs text-muted-foreground truncate">{image.alt}</span>
                <Button variant="outline" size="sm" onClick={() => handleDownload(image.src)}><Download className="mr-2 h-4 w-4" /> Download</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-secondary/50 border-dashed"><CardContent className="p-12 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold">No Images Available</h3>
          <p className="text-muted-foreground mt-2">Upload a product image and ConnectLocal will resize it to a maximum of 3 MB, categorize it and add it to the appropriate business-type library.</p>
          <Button asChild className="mt-4"><Link href="/dashboard/products"><PlusCircle className="mr-2 h-4 w-4" /> Add a Product</Link></Button>
        </CardContent></Card>
      )}
    </div>
  );
}

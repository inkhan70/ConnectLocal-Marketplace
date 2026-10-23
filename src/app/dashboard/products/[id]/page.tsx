
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import images from '@/app/lib/placeholder-images.json';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

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
    status: "Active" | "Archived" | "Low Stock" | "Out of Stock";
    inventory: number;
    category?: string;
    userId?: string;
    description?: string;
    varieties: Variety[];
}

export default function ProductVarietiesPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const productId = params.id as string;
    
    const productDocRef = useMemoFirebase(() => 
        productId ? doc(firestore, 'products', productId) : null,
        [firestore, productId]
    );
    
    const { data: product, isLoading: loading, error } = useDoc<Product>(productDocRef);

    useEffect(() => {
        if (error) {
            toast({
                title: 'Error',
                description: 'Could not fetch product details from the database.',
                variant: 'destructive',
            });
        } else if (!loading && !product && productId) {
             toast({
                title: 'Product not found',
                description: `Could not find a product with ID ${productId}.`,
                variant: 'destructive',
            });
            router.push('/dashboard');
        }
    }, [product, loading, error, productId, router, toast]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!product) {
        return <div className="text-center py-10">Product not found or you do not have permission to view it.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/dashboard">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold font-headline">{product.name}</h1>
                        <p className="text-muted-foreground">Viewing all varieties for this product line.</p>
                         <div className="flex items-center gap-2 mt-2">
                             <Badge 
                                variant={product.status === 'Active' ? 'default' : product.status === 'Low Stock' ? 'secondary' : 'destructive'} 
                                className={product.status === 'Active' ? 'bg-green-100 text-green-800' : product.status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' : ''}
                            >
                                {product.status}
                            </Badge>
                             <p className="text-sm text-muted-foreground">Inventory: {product.inventory}</p>
                         </div>
                    </div>
                </div>
                <Button asChild>
                    <Link href={`/dashboard/products?edit=${product.id}`}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Product & Varieties
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {product.varieties && product.varieties.map(variety => (
                    <Card key={variety.id} className="flex flex-col">
                        <CardHeader className="p-0">
                            <Image 
                                src={variety.image || images.product_form.preview} 
                                alt={variety.name}
                                width={300}
                                height={200}
                                className="rounded-t-lg object-cover w-full h-40"
                                data-ai-hint={variety.dataAiHint || 'product image'}
                            />
                        </CardHeader>
                        <CardContent className="p-4 flex-grow">
                            <CardTitle className="font-bold text-lg">{variety.name}</CardTitle>
                            <CardDescription className="text-primary font-semibold text-base mt-1">
                                ${variety.price.toFixed(2)}
                            </CardDescription>
                        </CardContent>
                    </Card>
                ))}
                 <Card className="border-dashed flex items-center justify-center">
                    <CardContent className="p-4 text-center">
                        <Button variant="outline" asChild>
                             <Link href={`/dashboard/products?edit=${product.id}`}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add New Variety
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

    

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Trash2, Edit, Loader2, Users } from "lucide-react";
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import images from '@/app/lib/placeholder-images.json';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, deleteDoc } from "firebase/firestore";

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
    varieties: Variety[];
}

export function BusinessDashboard() {
    const { toast } = useToast();
    const { user } = useAuth();
    const firestore = useFirestore();

    const productsQuery = useMemoFirebase(() => 
        user ? query(collection(firestore, 'products'), where('userId', '==', user.uid)) : null,
        [user, firestore]
    );
    const { data: products, isLoading: loading, error } = useCollection<Product>(productsQuery);

    const handleDelete = async (productId: string, productName: string) => {
        try {
            const productDocRef = doc(firestore, 'products', productId);
            await deleteDoc(productDocRef);
            
            toast({
                title: "Product Deleted",
                description: `"${productName}" has been removed.`,
            });
        } catch (error: any) {
            console.error("Error deleting product: ", error);
            toast({
                title: "Error",
                description: "Could not delete the product.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold font-headline">Business Dashboard</h1>
                    <p className="text-muted-foreground">An overview of your business activity.</p>
                </div>
                <div className="flex space-x-2">
                    <Button asChild>
                        <Link href="/dashboard/products">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Manage Products</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="hidden w-[100px] sm:table-cell">Image</TableHead>
                                <TableHead>Product / Brand</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">Inventory</TableHead>
                                <TableHead className="hidden md:table-cell">Varieties</TableHead>
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></TableCell></TableRow>
                            ) : error ? (
                                <TableRow><TableCell colSpan={6} className="text-center text-destructive py-12">Error loading products: {error.message}</TableCell></TableRow>
                            ) : products && products.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <Users className="mx-auto h-10 w-10 mb-2 text-muted-foreground"/>
                                        <p className="font-semibold mb-2">No products found.</p>
                                        <p className="text-muted-foreground mb-4">Get started by adding your first product.</p>
                                        <Button asChild size="sm"><Link href="/dashboard/products"><PlusCircle className="mr-2 h-4 w-4" /> Add Product</Link></Button>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                products && products.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell className="hidden sm:table-cell">
                                            <Image alt={product.name} className="aspect-square rounded-md object-cover" height="40" src={product.varieties?.[0]?.image || images.products.dashboard_product} width="40" data-ai-hint={product.varieties?.[0]?.dataAiHint || "product image"} />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <Link href={`/products/item/${product.id}`} className="hover:underline">{product.name}</Link>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={product.status === 'Active' ? 'default' : product.status === 'Low Stock' ? 'secondary' : 'destructive'} className={product.status === 'Active' ? 'bg-green-100 text-green-800' : product.status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' : ''}>{product.status}</Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">{product.inventory}</TableCell>
                                        <TableCell className="hidden md:table-cell">{product.varieties?.length || 0}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem asChild><Link href={`/dashboard/products?edit=${product.id}`}><Edit className="mr-2 h-4 w-4" /> Edit</Link></DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <AlertDialog><AlertDialogTrigger asChild>
                                                            <DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-50" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This action cannot be undone. This will permanently delete the product "{product.name}".</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDelete(product.id, product.name)}>Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

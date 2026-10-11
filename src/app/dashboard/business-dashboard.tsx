
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Trash2, Edit, Loader2, Users, Gem } from "lucide-react";
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
import { collection, query, where } from "firebase/firestore";

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
    const { user, userProfile } = useAuth();
    const firestore = useFirestore();
    const [rewardCoins, setRewardCoins] = useState(Math.max(0, Math.floor(userProfile?.ghostCoinRewardPerSale || 0)));
    const [rewardMinimumQuantity, setRewardMinimumQuantity] = useState(Math.max(1, Math.floor(userProfile?.ghostCoinMinimumQuantity || 1)));
    const [rewardEnabled, setRewardEnabled] = useState(userProfile?.ghostCoinOfferEnabled === true);
    const [savingReward, setSavingReward] = useState(false);

    const saveGhostCoinOffer = async () => {
        if (!user) return;
        setSavingReward(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/rewards/settings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ghostCoinRewardPerSale: rewardCoins, ghostCoinMinimumQuantity: rewardMinimumQuantity, ghostCoinOfferEnabled: rewardEnabled }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not save offer.');
            toast({ title: 'Ghost Coin offer saved', description: rewardEnabled ? `Buyers can earn ${rewardCoins} Ghost Coins on qualifying completed sales.` : 'Your Ghost Coin offer is currently disabled.' });
        } catch (error: any) {
            toast({ title: 'Could not save reward offer', description: error.message, variant: 'destructive' });
        } finally { setSavingReward(false); }
    };

    const productsQuery = useMemoFirebase(() => 
        user ? query(collection(firestore, 'products'), where('userId', '==', user.uid)) : null,
        [user, firestore]
    );
    const { data: products, isLoading: loading, error } = useCollection<Product>(productsQuery);

    const handleDelete = async (productId: string, productName: string) => {
        try {
            if (!user) throw new Error('Authentication session expired.');
            const token = await user.getIdToken();
            const response = await fetch('/api/products', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ productId }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result?.error || 'Could not delete the product.');
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
                    <CardTitle className="flex items-center gap-2"><Gem className="h-5 w-5" />Ghost Coin Offer</CardTitle>
                    <CardDescription>Choose how many Ghost Coins buyers receive after a qualifying sale is completed. The reward is paid by your seller offer, not automatically by the app.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div><label className="text-sm font-medium">Coins per completed sale</label><input className="mt-1 w-full rounded-md border bg-background px-3 py-2" type="number" min="0" step="1" value={rewardCoins} onChange={e => setRewardCoins(Math.max(0, Math.floor(Number(e.target.value || 0))))} /></div>
                        <div><label className="text-sm font-medium">Minimum items in order</label><input className="mt-1 w-full rounded-md border bg-background px-3 py-2" type="number" min="1" step="1" value={rewardMinimumQuantity} onChange={e => setRewardMinimumQuantity(Math.max(1, Math.floor(Number(e.target.value || 1))))} /><p className="mt-1 text-xs text-muted-foreground">Example: 1,000 items + 5 coins.</p></div>
                        <div className="flex items-end gap-3 pb-2"><input id="ghost-offer-enabled" type="checkbox" checked={rewardEnabled} onChange={e => setRewardEnabled(e.target.checked)} className="h-4 w-4" /><label htmlFor="ghost-offer-enabled" className="text-sm font-medium">Offer enabled</label></div>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-md bg-muted p-3 text-sm"><span>{rewardEnabled ? `Qualifying buyers receive ${rewardCoins} Ghost Coins when the order is completed.` : 'Ghost Coin rewards are disabled for your store.'}</span><Button onClick={saveGhostCoinOffer} disabled={savingReward}>{savingReward && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Offer</Button></div>
                </CardContent>
            </Card>

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
                                            <Link href={`/dashboard/products/${product.id}`} className="hover:underline">{product.name}</Link>
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

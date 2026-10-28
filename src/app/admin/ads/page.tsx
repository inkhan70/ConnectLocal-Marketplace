
"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2, Loader2, Megaphone, ShoppingBag, Award, Power } from "lucide-react";
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, setDoc, deleteDoc, serverTimestamp, query, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

const iconMap = {
    ShoppingBag,
    Award,
    Megaphone
};

const audienceRoles = ["guest", "buyer", "company", "wholesaler", "distributor", "shopkeeper", "services"];
const adTypes = ["banner", "featured_product", "sponsored_category", "push_notification", "interstitial"] as const;

const adSchema = z.object({
  title: z.string().min(1, "Title is required."),
  description: z.string().min(1, "Description is required."),
  icon: z.enum(["ShoppingBag", "Award", "Megaphone"]),
  targetAudience: z.array(z.string()).min(1, "At least one target audience must be selected."),
  type: z.enum(adTypes),
  targetRegions: z.string().optional(),
  targetCategories: z.string().optional(),
  subscriptionTiers: z.string().optional(),
  budget: z.coerce.number().min(0).default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type AdFormValues = z.infer<typeof adSchema>;

export interface Ad {
    id: string;
    title: string;
    description: string;
    icon: "ShoppingBag" | "Award" | "Megaphone";
    targetAudience: string[];
    type?: typeof adTypes[number];
    targetRegions?: string[];
    targetCategories?: string[];
    subscriptionTiers?: string[];
    budget?: number;
    startDate?: string;
    endDate?: string;
    status?: 'active' | 'paused' | 'expired';
    impressions?: number;
    clicks?: number;
    createdAt: any;
}


export default function AdminAdsPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isSaving, setIsSaving] = useState(false);

    const adsQuery = useMemoFirebase(() => query(collection(firestore, "ads")), [firestore]);
    const { data: ads, isLoading, error } = useCollection<Ad>(adsQuery);

    const form = useForm<AdFormValues>({
        resolver: zodResolver(adSchema),
        defaultValues: {
            title: "",
            description: "",
            icon: "Megaphone",
            targetAudience: [],
            type: "banner",
            budget: 0,
            targetRegions: "",
            targetCategories: "",
            subscriptionTiers: "",
            startDate: "",
            endDate: "",
        },
    });

    const { handleSubmit, control, reset } = form;

    const handleAddAd = async (data: AdFormValues) => {
        setIsSaving(true);
        try {
            const adId = uuidv4();
            const adRef = doc(firestore, 'ads', adId);
            await setDoc(adRef, {
                id: adId,
                ...data,
                type: data.type,
                targetRegions: data.targetRegions?.split(',').map((value) => value.trim()).filter(Boolean) || [],
                targetCategories: data.targetCategories?.split(',').map((value) => value.trim()).filter(Boolean) || [],
                subscriptionTiers: data.subscriptionTiers?.split(',').map((value) => value.trim()).filter(Boolean) || [],
                budget: data.budget || 0,
                status: 'active',
                impressions: 0,
                clicks: 0,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Success", description: "New advertisement created." });
            reset();
        } catch (err) {
            console.error("Error creating ad: ", err);
            toast({ title: "Error", description: "Could not create advertisement.", variant: "destructive"});
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleAd = async (ad: Ad) => {
        const nextStatus = ad.status === 'active' ? 'paused' : 'active';
        await updateDoc(doc(firestore, 'ads', ad.id), { status: nextStatus });
        toast({ title: 'Ad status updated', description: `Advertisement ${nextStatus}.` });
    };

    const handleDeleteAd = async (id: string) => {
        try {
            await deleteDoc(doc(firestore, "ads", id));
            toast({ title: "Ad Deleted", description: "The advertisement has been removed." });
        } catch (err) {
            console.error("Error deleting ad: ", err);
            toast({ title: "Error", description: "Could not delete the advertisement.", variant: "destructive"});
        }
    };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-headline">Manage Advertisements</h1>
        <p className="text-muted-foreground">
          Create and manage promotional banners for different user roles.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
            <CardHeader>
                <CardTitle>Create New Ad</CardTitle>
                <CardDescription>
                    Fill out the form to create a new ad banner.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleSubmit(handleAddAd)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="ad-title">Title</Label>
                    <Controller
                        name="title"
                        control={control}
                        render={({ field }) => <Input id="ad-title" {...field} placeholder="e.g., 'Special Offer!'" disabled={isSaving}/>}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="ad-desc">Description</Label>
                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => <Textarea id="ad-desc" {...field} placeholder="e.g., 'Get 20% off on all items.'" disabled={isSaving}/>}
                    />
                </div>
                 <div className="space-y-2"><Label htmlFor="ad-type">Ad Type</Label><Controller name="type" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}><SelectTrigger id="ad-type"><SelectValue /></SelectTrigger><SelectContent>{adTypes.map((type) => <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>} /></div>
                <div className="space-y-2">
                    <Label htmlFor="ad-icon">Icon</Label>
                     <Controller
                        name="icon"
                        control={control}
                        render={({ field }) => (
                           <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                                <SelectTrigger id="ad-icon">
                                    <SelectValue placeholder="Select an icon" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(iconMap).map(([name, IconComponent]) => (
                                        <SelectItem key={name} value={name}>
                                            <div className="flex items-center gap-2">
                                                <IconComponent className="h-4 w-4" />
                                                <span>{name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Card className="p-4 bg-background">
                         <Controller
                            name="targetAudience"
                            control={control}
                            render={({ field }) => (
                                <div className="grid grid-cols-2 gap-4">
                                {audienceRoles.map((role) => (
                                    <div key={role} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={role}
                                            checked={field.value?.includes(role)}
                                            onCheckedChange={(checked) => {
                                                return checked
                                                ? field.onChange([...(field.value || []), role])
                                                : field.onChange(field.value?.filter((value) => value !== role))
                                            }}
                                        />
                                        <label htmlFor={role} className="text-sm font-medium capitalize">{role}</label>
                                    </div>
                                ))}
                                </div>
                            )}
                        />
                    </Card>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label htmlFor="ad-regions">Regions</Label><Controller name="targetRegions" control={control} render={({ field }) => <Input id="ad-regions" {...field} placeholder="e.g. Lahore, Punjab" disabled={isSaving} />} /></div><div><Label htmlFor="ad-categories">Categories</Label><Controller name="targetCategories" control={control} render={({ field }) => <Input id="ad-categories" {...field} placeholder="e.g. food, electronics" disabled={isSaving} />} /></div><div><Label htmlFor="ad-tiers">Subscription tiers</Label><Controller name="subscriptionTiers" control={control} render={({ field }) => <Input id="ad-tiers" {...field} placeholder="e.g. community, plus" disabled={isSaving} />} /></div><div><Label htmlFor="ad-budget">Budget</Label><Controller name="budget" control={control} render={({ field }) => <Input id="ad-budget" type="number" min="0" step="0.01" {...field} disabled={isSaving} />} /></div><div><Label htmlFor="ad-start">Start date</Label><Controller name="startDate" control={control} render={({ field }) => <Input id="ad-start" type="datetime-local" {...field} disabled={isSaving} />} /></div><div><Label htmlFor="ad-end">End date</Label><Controller name="endDate" control={control} render={({ field }) => <Input id="ad-end" type="datetime-local" {...field} disabled={isSaving} />} /></div></div>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Create Ad
                </Button>
            </form>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Live Advertisements</CardTitle>
                <CardDescription>List of all current ads in the database.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : ads && ads.length > 0 ? (
                    <ul className="space-y-3">
                        {ads.map(ad => {
                            const IconComponent = iconMap[ad.icon] || Megaphone;
                            return (
                                <li key={ad.id} className="flex items-start justify-between p-3 rounded-md border">
                                    <div className="flex items-start gap-4">
                                        <IconComponent className="h-6 w-6 text-muted-foreground mt-1" />
                                        <div className="flex-1">
                                            <p className="font-semibold">{ad.title}</p>
                                            <p className="text-sm text-muted-foreground">{ad.description}</p>
                                            <div className="flex flex-wrap gap-1 mt-2">{ad.targetAudience.map(role => <span key={role} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{role}</span>)}<span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{ad.type || 'banner'}</span><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{ad.status || 'active'}</span></div><p className="text-xs text-muted-foreground mt-1">Impressions: {ad.impressions || 0} · Clicks: {ad.clicks || 0} · Budget: ${ad.budget || 0}</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleToggleAd(ad)} title={ad.status === 'active' ? 'Pause ad' : 'Activate ad'}><Power className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the ad: <strong>{ad.title}</strong>.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction className="bg-destructive hover:bg-destructive/80" onClick={() => handleDeleteAd(ad.id)}>
                                                Delete
                                            </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No advertisements found.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

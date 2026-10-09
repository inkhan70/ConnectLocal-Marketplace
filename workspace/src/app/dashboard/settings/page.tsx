"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Loader2, Upload, Trash2, ImageIcon, Sparkles, Banknote } from "lucide-react";
import { Location } from "@/components/Location";
import { useFirestore, storage } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import Image from "next/image";
import { generateSlogan } from "@/ai/flows/generate-slogan-flow";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const profileFormSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters."),
  address: z.string().min(10, "Full address is required."),
  city: z.string().min(2, "City is required."),
  state: z.string().min(2, "State is required."),
  // storefrontWallpaper is handled separately and not part of the form's direct input
  storefrontWallpaper: z.string().optional(),
  businessDescription: z.string().max(500, "Description cannot exceed 500 characters.").optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;


export default function SettingsPage() {
    const { user, userProfile } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isGeneratingSlogan, setIsGeneratingSlogan] = useState(false);
    const firestore = useFirestore();

    const [wallpaperPreview, setWallpaperPreview] = useState<string | null>(null);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            businessName: "",
            address: "",
            city: "",
            state: "",
            storefrontWallpaper: "",
            businessDescription: "",
        },
        mode: "onChange",
    });

    useEffect(() => {
        if(userProfile) {
            form.reset({
                businessName: userProfile.businessName || "",
                address: userProfile.address || "",
                city: userProfile.city || "",
                state: userProfile.state || "",
                storefrontWallpaper: userProfile.storefrontWallpaper || "",
                businessDescription: userProfile.businessDescription || "",
            });
            if (userProfile.storefrontWallpaper) {
                setWallpaperPreview(userProfile.storefrontWallpaper);
            }
        }
    }, [userProfile, form]);
    
     const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast({
                    title: "Image Too Large",
                    description: "Please select an image smaller than 5MB.",
                    variant: "destructive"
                });
                return;
            }
            
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                handleWallpaperUpload(dataUrl);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleWallpaperUpload = async (dataUrl: string) => {
        if (!user) {
            toast({ title: "Not Authenticated", description: "You must be logged in to upload a wallpaper.", variant: "destructive" });
            return;
        }
        setIsUploading(true);

        try {
            // Define the fixed storage path for the user's storefront wallpaper.
            // This ensures that subsequent uploads for the same user will overwrite the previous one.
            const storagePath = `products/${user.uid}/storefront-wallpaper.jpg`;
            const storageRef = ref(storage, storagePath);

            // Upload new image. This will overwrite any existing file at the 'storagePath'.
            const snapshot = await uploadString(storageRef, dataUrl, 'data_url');
            const newImageUrl = await getDownloadURL(snapshot.ref);

            // Update user profile in Firestore with the new download URL.
            const userDocRef = doc(firestore, "users", user.uid);
            await updateDoc(userDocRef, { storefrontWallpaper: newImageUrl });
            
            setWallpaperPreview(newImageUrl);
            toast({
                title: "Wallpaper Updated",
                description: "Your new storefront wallpaper has been saved.",
            });

        } catch (error) {
            console.error("Error uploading wallpaper:", error);
            toast({
                title: "Upload Failed",
                description: "There was a problem uploading your new wallpaper.",
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
        }
    }

    const handleRemoveWallpaper = async () => {
        if (!user) {
            toast({ title: "Not Authenticated", description: "You must be logged in to remove your wallpaper.", variant: "destructive" });
            return;
        }
        // Only proceed if there's a wallpaper URL in the profile, indicating one exists
        if (!userProfile?.storefrontWallpaper) {
            toast({ title: "No Wallpaper", description: "There is no wallpaper to remove." });
            return;
        }

        setIsUploading(true);
        try {
            // Use the fixed storage path for deletion.
            // This assumes the wallpaper is always stored at `products/${user.uid}/storefront-wallpaper.jpg`.
            const storagePath = `products/${user.uid}/storefront-wallpaper.jpg`;
            const imageRef = ref(storage, storagePath);
            await deleteObject(imageRef);

            // Clear the download URL from the user's Firestore profile
            const userDocRef = doc(firestore, "users", user.uid);
            await updateDoc(userDocRef, { storefrontWallpaper: "" });
            
            setWallpaperPreview(null);
            toast({ title: "Wallpaper Removed" });
        } catch (error: any) {
            // Handle cases where the file might already be gone from Storage (e.g., manually deleted)
            if (error.code === 'storage/object-not-found') {
                console.warn("Attempted to delete wallpaper not found in storage. Clearing Firestore reference.", error);
                const userDocRef = doc(firestore, "users", user.uid);
                await updateDoc(userDocRef, { storefrontWallpaper: "" });
                setWallpaperPreview(null);
                toast({ title: "Wallpaper Removed (from profile, file not found in storage)" });
            } else {
                 console.error("Error removing wallpaper:", error);
                 toast({ title: "Error", description: "Could not remove wallpaper. Please try again.", variant: "destructive" });
            }
        } finally {
            setIsUploading(false);
        }
    }

    const handleGenerateSlogan = async () => {
        if (!user || !userProfile?.businessName || !userProfile?.category) {
            toast({ title: "Missing Info", description: "Business name and category are required to generate a slogan.", variant: "destructive" });
            return;
        }

        setIsGeneratingSlogan(true);
        try {
            const result = await generateSlogan({
                businessName: userProfile.businessName,
                category: userProfile.category,
            });

            if (result.slogan) {
                const userDocRef = doc(firestore, "users", user.uid);
                await updateDoc(userDocRef, { slogan: result.slogan });
                toast({
                    title: "Slogan Generated!",
                    description: `Your new slogan is: "${result.slogan}"`,
                });
            }
        } catch (error) {
            console.error("Error generating slogan:", error);
            toast({ title: "Generation Failed", description: "Could not generate slogan.", variant: "destructive" });
        } finally {
            setIsGeneratingSlogan(false);
        }
    };


    const onSubmit = async (data: ProfileFormValues) => {
        if (!user || !userProfile) {
            toast({ title: "Not Authenticated", description: "You must be logged in to update your profile.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            await updateDoc(userDocRef, {
                businessName: data.businessName,
                address: data.address,
                city: data.city,
                state: data.state,
                businessDescription: data.businessDescription,
            });
            
            toast({
                title: "Profile Updated",
                description: "Your business information has been successfully updated.",
            });
            // The AuthContext will automatically show the updated data due to real-time updates.
           
        } catch (error) {
            console.error("Error updating profile in Firestore: ", error);
            toast({
                title: "Update Failed",
                description: "There was a problem saving your changes. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const capitalizeFirstLetter = (string: string) => {
        if (!string) return string;
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    const isBusiness = userProfile?.role && userProfile.role !== 'buyer';

    if (!userProfile) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-2xl font-bold font-headline">Settings</h1>
                <p className="text-muted-foreground">Manage your account and business details.</p>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Business Profile</CardTitle>
                    <CardDescription>Update your public business information here.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                             <div className="grid md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="businessName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Business Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Your Business Name" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div>
                                    <Label>Email</Label>
                                    <Input value={userProfile?.email || ""} disabled />
                                     <FormDescription className="mt-2">
                                        Your email address cannot be changed.
                                    </FormDescription>
                                </div>
                                 <div>
                                    <Label>Primary Category</Label>
                                    <Input value={userProfile?.category ? capitalizeFirstLetter(userProfile.category) : ""} disabled />
                                     <FormDescription className="mt-2">
                                        Your business category cannot be changed.
                                    </FormDescription>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="businessDescription"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                        <FormLabel>About Your Business</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Tell customers about your business, your history, and what makes you special."
                                                className="resize-y min-h-[100px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                             </div>
                            
                            <Location />

                            <div className="flex justify-end">
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {isBusiness && (
            <Card>
                <CardHeader>
                    <CardTitle>AI Marketing Tools</CardTitle>
                    <CardDescription>Generate marketing assets for your business profile.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div>
                        <Label>Business Slogan</Label>
                        {userProfile.slogan ? (
                            <p className="text-lg italic text-muted-foreground mt-2">"{userProfile.slogan}"</p>
                        ) : (
                            <p className="text-sm text-muted-foreground mt-2">No slogan generated yet.</p>
                        )}
                    </div>
                    <Button variant="outline" onClick={handleGenerateSlogan} disabled={isGeneratingSlogan}>
                        {isGeneratingSlogan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {userProfile.slogan ? "Regenerate Slogan" : "Generate Slogan with AI"}
                    </Button>
                </CardContent>
            </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Storefront Hero Image</CardTitle>
                    <CardDescription>Upload a background image for your public business page. (Max 5MB)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="wallpaper-upload" className="flex-grow">
                             <Button asChild variant="outline" className="w-full justify-center" disabled={isUploading}>
                                <span>
                                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/> }
                                    {isUploading ? "Uploading..." : "Upload New Image"}
                                </span>
                             </Button>
                             <Input id="wallpaper-upload" type="file" className="sr-only" accept="image/*" onChange={handleWallpaperChange} disabled={isUploading}/>
                        </Label>
                        {wallpaperPreview && (
                             <Button variant="destructive" onClick={handleRemoveWallpaper} disabled={isUploading}>
                                <Trash2 className="mr-2 h-4 w-4"/>
                                Remove
                            </Button>
                        )}
                    </div>
                    <div className="mt-2">
                        <h3 className="text-sm font-medium mb-2">Preview:</h3>
                        <div className="aspect-video w-full max-w-md rounded-md border border-dashed flex items-center justify-center bg-muted/50" >
                             {isUploading ? (
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                             ) : wallpaperPreview ? (
                                <Image src={wallpaperPreview} alt="Wallpaper preview" width={400} height={225} className="object-cover rounded-md"/>
                             ) : (
                                <div className="text-center text-muted-foreground p-4">
                                    <ImageIcon className="mx-auto h-8 w-8 mb-2" />
                                    <p>No wallpaper set</p>
                                </div>
                             )}
                        </div>
                    </div>
                </CardContent>
            </Card>

             {isBusiness && (
                <Card>
                    <CardHeader>
                        <CardTitle>Local Payment Settings</CardTitle>
                        <CardDescription>Connect your local payment accounts to receive funds from sales. This feature is coming soon.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-8 text-center border-dashed border-2 rounded-md flex flex-col items-center">
                            <Banknote className="h-10 w-10 text-muted-foreground mb-4" />
                            <p className="font-medium">Local payment integration is not yet available.</p>
                            <p className="text-sm text-muted-foreground">Check back later to connect your bank or mobile money accounts.</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

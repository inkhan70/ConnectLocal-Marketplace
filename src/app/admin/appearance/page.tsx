
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { useToast } from "@/hooks/use-toast";
import { ImageIcon, Upload, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function AppearancePage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const pagePath = searchParams.get('page') || '/';
  const [localStorageKey, setLocalStorageKey] = useState('');

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This code now runs only on the client, avoiding hydration errors.
    const key = `wallpaper_${pagePath}`;
    setLocalStorageKey(key);
    try {
      const storedWallpaper = localStorage.getItem(key);
      if (storedWallpaper) {
        setPreviewImage(storedWallpaper);
      }
    } catch (error) {
      console.error("Error fetching wallpaper from localStorage:", error);
      toast({ title: "Error", description: "Could not load existing wallpaper from your browser.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [pagePath, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
            title: "Image Too Large",
            description: `Please select an image smaller than 10 MB.`,
            variant: "destructive"
        });
        setPreviewImage(null);
        setSelectedFile(null);
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile(file);
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile || !previewImage) {
        toast({
            title: "No Image Selected",
            description: "Please select an image file to upload.",
            variant: "destructive"
        });
        return;
    }
    
    setIsSubmitting(true);
    try {
        localStorage.setItem(localStorageKey, previewImage);
        setSelectedFile(null);

        toast({
          title: "Wallpaper Updated",
          description: `The background for ${pagePath} has been set in your browser.`,
        });
        window.dispatchEvent(new Event('storage')); // Notify other tabs
    } catch (error) {
        toast({
            title: "Failed to Save Wallpaper",
            description: "An error occurred while saving the image to your browser.",
            variant: "destructive"
        });
        console.error("Error saving wallpaper to localStorage:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleRemoveWallpaper = () => {
    setIsSubmitting(true);
    try {
        localStorage.removeItem(localStorageKey);
        setPreviewImage(null);
        setSelectedFile(null);
        const fileInput = document.getElementById('wallpaper-upload') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = "";
        }
        toast({
            title: "Wallpaper Removed",
            description: `The background for ${pagePath} has been removed from your browser.`
        });
        window.dispatchEvent(new Event('storage')); // Notify other tabs
    } catch (error) {
        toast({
            title: "Error Removing Wallpaper",
            description: "Could not remove the wallpaper.",
            variant: "destructive"
        });
        console.error("Error removing wallpaper from localStorage:", error);
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-headline">Appearance</h1>
        <p className="text-muted-foreground">
          Customize the look and feel of your application.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Page Wallpaper</CardTitle>
          <CardDescription>
            Set a background for the <code className="bg-muted px-2 py-1 rounded-md">{pagePath}</code> page. This will only be visible in your current browser.
             <br />
             Go back to the page: <Link href={pagePath} className="text-primary underline">Go to {pagePath}</Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="wallpaper-upload">Upload Background Image (Max 10MB)</Label>
              <div className="flex items-center space-x-2 mt-2">
                 <div className="flex-grow">
                    <Input id="wallpaper-upload" type="file" accept="image/*" onChange={handleFileChange} className="w-full" disabled={isSubmitting} />
                    {selectedFile && <p className="text-sm text-muted-foreground mt-1">Selected: {selectedFile.name}</p>}
                 </div>
                <Button type="submit" disabled={isSubmitting || !selectedFile}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                    Save
                </Button>
                <Button type="button" variant="destructive" onClick={handleRemoveWallpaper} disabled={isSubmitting || !previewImage}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                    Remove
                </Button>
              </div>
            </div>
            
            <div className="mt-4">
                <h3 className="text-sm font-medium">Preview:</h3>
                <div className="mt-2 aspect-video w-full max-w-md rounded-md border border-dashed flex items-center justify-center bg-cover bg-center" style={{backgroundImage: `url(${previewImage})`}}>
                    {isLoading && <Loader2 className="h-6 w-6 animate-spin"/>}
                    {!isLoading && !previewImage && <div className="text-center text-muted-foreground p-4"><ImageIcon className="mx-auto h-8 w-8 mb-2" /><p>Select an image to see a preview</p></div>}
                </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

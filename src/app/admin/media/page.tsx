
"use client";

import { useState, useEffect, useRef } from "react";
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
import { Upload, Loader2, ImageIcon, ImagePlus, Library } from "lucide-react";
import { useFirestore, useDoc, useMemoFirebase, storage } from "@/firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import Image from "next/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Category {
    id: string;
    name: string;
    icon: string;
    order: number;
}

interface CategoriesDoc {
    list: Category[];
}

const OPTIMAL_WIDTH = 1280;
const OPTIMAL_HEIGHT = 720;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function AdminMediaPage() {
    const { toast } = useToast();
    const firestore = useFirestore();

    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [appCategories, setAppCategories] = useState<Category[]>([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const categoriesDocRef = useMemoFirebase(() => doc(firestore, 'app_config', 'categories'), [firestore]);
    const { data: categoriesDoc, isLoading: loading, error } = useDoc<CategoriesDoc>(categoriesDocRef);

    useEffect(() => {
        if (categoriesDoc && categoriesDoc.list) {
            setAppCategories(categoriesDoc.list.sort((a, b) => a.order - b.order));
        }
        setIsLoadingCategories(loading);
    }, [categoriesDoc, loading]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            
            if (file.size > MAX_FILE_SIZE_BYTES) {
                toast({
                    title: "Image Too Large",
                    description: `Please select an image smaller than ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
                    variant: "destructive"
                });
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
    
    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!previewImage || !selectedCategory) {
            toast({ title: "Missing Information", description: "Please select an image and a category.", variant: "destructive" });
            return;
        }

        setIsUploading(true);

        try {
            const canvas = canvasRef.current;
            const img = document.createElement('img');

            const resizedDataUrl = await new Promise<string>((resolve, reject) => {
                img.onload = () => {
                    if (!canvas) {
                        reject(new Error("Canvas not available"));
                        return;
                    }
                    canvas.width = OPTIMAL_WIDTH;
                    canvas.height = OPTIMAL_HEIGHT;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error("Canvas context not available"));
                        return;
                    }
                    ctx.drawImage(img, 0, 0, OPTIMAL_WIDTH, OPTIMAL_HEIGHT);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                };
                img.onerror = reject;
                img.src = previewImage;
            });
            
            const imageId = uuidv4();
            const storageRef = ref(storage, `library/${selectedCategory}/${imageId}.jpg`);
            const snapshot = await uploadString(storageRef, resizedDataUrl, 'data_url');
            const downloadURL = await getDownloadURL(snapshot.ref);

            // This part is optional: save metadata to Firestore if you want to query images later.
            // For now, we'll just upload to storage.
            // const imageDocRef = doc(firestore, `library/${selectedCategory}/images/${imageId}`);
            // await setDoc(imageDocRef, {
            //     url: downloadURL,
            //     category: selectedCategory,
            //     createdAt: serverTimestamp()
            // });

            toast({ title: "Upload Successful", description: `Image added to the ${selectedCategory} library.` });

            // Reset form
            setSelectedFile(null);
            setPreviewImage(null);
            setSelectedCategory("");
            const fileInput = document.getElementById('image-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = "";

        } catch (err) {
            console.error("Error uploading image:", err);
            toast({ title: "Upload Failed", description: "Could not upload the image.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold font-headline">Media Library</h1>
                <p className="text-muted-foreground">
                    Upload and manage shared images for business categories.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Upload New Image</CardTitle>
                    <CardDescription>
                        Images will be automatically resized to {OPTIMAL_WIDTH}x{OPTIMAL_HEIGHT} pixels.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpload} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <Label htmlFor="image-upload">Image File (Max 10MB)</Label>
                                <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
                                {selectedFile && <p className="text-sm text-muted-foreground mt-1">Selected: {selectedFile.name}</p>}
                             </div>
                             <div className="space-y-2">
                                <Label htmlFor="cat-select">Assign to Category</Label>
                                <Select onValueChange={setSelectedCategory} value={selectedCategory} disabled={isUploading || isLoadingCategories}>
                                    <SelectTrigger id="cat-select">
                                        <SelectValue placeholder={isLoadingCategories ? "Loading..." : "Select a category"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {appCategories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                             </div>
                        </div>

                        <div>
                            <Label>Preview</Label>
                            <div className="mt-2 aspect-video w-full max-w-lg rounded-md border border-dashed flex items-center justify-center bg-muted/50" >
                                {isUploading ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                                 ) : previewImage ? (
                                    <Image src={previewImage} alt="Image preview" width={OPTIMAL_WIDTH/2} height={OPTIMAL_HEIGHT/2} className="object-contain rounded-md"/>
                                 ) : (
                                    <div className="text-center text-muted-foreground p-4">
                                        <ImageIcon className="mx-auto h-8 w-8 mb-2" />
                                        <p>Select an image to see a preview</p>
                                    </div>
                                 )}
                            </div>
                        </div>
                        
                        <Button type="submit" disabled={isUploading || !selectedFile || !selectedCategory}>
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                            Upload to Library
                        </Button>
                    </form>
                </CardContent>
            </Card>
             <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
    );
}

    
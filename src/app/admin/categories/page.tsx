
"use client";

import { useState, useEffect } from "react";
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
import { PlusCircle, Trash2, UtensilsCrossed, GlassWater, Laptop, Pill, Footprints, Scissors, Gem, Building, MoreHorizontal, Shirt, Home, Car, Wrench, Bone, Loader2 } from "lucide-react";
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
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";


export interface Category {
    id: string;
    name: string;
    icon: string;
    order: number;
}

interface CategoriesDoc {
    list: Category[];
}

const iconMap: { [key: string]: React.ElementType } = {
    UtensilsCrossed, GlassWater, Laptop, Pill, Footprints, Scissors, Gem, Building, MoreHorizontal, Shirt, Home, Car, Wrench, Bone
};

const defaultCategories: Category[] = [
    { id: 'cat1', name: 'Food', icon: "UtensilsCrossed", order: 1},
    { id: 'cat2', name: 'Drinks', icon: "GlassWater", order: 2},
    { id: 'cat3', name: 'Electronics', icon: "Laptop", order: 3},
    { id: 'cat4', name: 'Medical', icon: "Pill", order: 4},
    { id: 'cat5', name: 'Shoes', icon: "Footprints", order: 5},
    { id: 'cat6', name: 'Beauty', icon: "Scissors", order: 6},
    { id: 'cat7', name: 'Jewelry', icon: "Gem", order: 7},
    { id: 'cat8', name: 'Real Estate', icon: "Building", order: 8},
    { id: 'cat9', name: 'Apparel', icon: 'Shirt', order: 9 },
    { id: 'cat10', name: 'Home & Garden', icon: 'Home', order: 10 },
    { id: 'cat11', name: 'Automotive', icon: 'Car', order: 11 },
    { id: 'cat12', name: 'Services', icon: 'Wrench', order: 12 },
    { id: 'cat13', name: 'Pets', icon: 'Bone', order: 13 },
];

export default function AdminCategoriesPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    
    const [categoryName, setCategoryName] = useState("");
    const [categoryIcon, setCategoryIcon] = useState("");
    const [categories, setCategories] = useState<Category[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const categoriesDocRef = useMemoFirebase(() => doc(firestore, 'app_config', 'categories'), [firestore]);
    const { data: categoriesDoc, isLoading: loading, error } = useDoc<CategoriesDoc>(categoriesDocRef);

    useEffect(() => {
        if (categoriesDoc) {
            // If the document exists, use its data. If list is empty/null, use defaults.
            const categoryList = categoriesDoc.list && categoriesDoc.list.length > 0 ? categoriesDoc.list : defaultCategories;
            setCategories(categoryList.sort((a, b) => a.order - b.order));
        } else if (!loading && !categoriesDoc) {
            // If doc doesn't exist and we're not loading, initialize with defaults
            setCategories(defaultCategories);
        }
        if (error) {
            toast({ title: "Error", description: "Could not load categories.", variant: "destructive"});
        }
    }, [categoriesDoc, loading, error, toast]);

    const saveCategories = async (updatedCategories: Category[]) => {
        setIsSaving(true);
        try {
            await setDoc(categoriesDocRef, { list: updatedCategories });
            toast({ title: "Success", description: "Category list updated." });
        } catch (err) {
            console.error("Error saving categories: ", err);
            toast({ title: "Error", description: "Could not save categories.", variant: "destructive"});
        } finally {
            setIsSaving(false);
        }
    };


    const handleAddCategory = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!categoryName || !categoryIcon) {
            toast({ title: "Missing Fields", description: "Please provide a name and select an icon.", variant: "destructive" });
            return;
        }

        const newCategory: Category = { 
            id: `cat_${Date.now()}`, 
            name: categoryName, 
            icon: categoryIcon, 
            order: categories.length + 1,
        };

        const updatedCategories = [...categories, newCategory];
        saveCategories(updatedCategories);

        setCategoryName("");
        setCategoryIcon("");
    };

    const handleRemoveCategory = (id: string) => {
        const updatedCategories = categories.filter(cat => cat.id !== id);
        saveCategories(updatedCategories);
    };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-headline">Manage Categories</h1>
        <p className="text-muted-foreground">
          Add or remove application categories. Changes will be visible to all users.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
            <CardHeader>
                <CardTitle>Add New Category</CardTitle>
                <CardDescription>
                    Create a new category for businesses and products.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleAddCategory} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="cat-name">Category Name</Label>
                    <Input id="cat-name" value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="e.g., Apparel" disabled={isSaving}/>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="cat-icon">Category Icon</Label>
                    <Select value={categoryIcon} onValueChange={setCategoryIcon} disabled={isSaving}>
                        <SelectTrigger id="cat-icon">
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
                </div>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Add Category
                </Button>
            </form>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Existing Categories</CardTitle>
                <CardDescription>List of all current categories.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : categories.length > 0 ? (
                    <ul className="space-y-2">
                        {categories.map(cat => {
                            const IconComponent = iconMap[cat.icon] || MoreHorizontal;
                            return (
                                <li key={cat.id} className="flex items-center justify-between p-2 rounded-md border">
                                    <div className="flex items-center gap-3">
                                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                                        <p className="font-semibold">{cat.name}</p>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="icon" disabled={isSaving}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the <strong>{cat.name}</strong> category.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleRemoveCategory(cat.id)}>
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
                    <p className="text-sm text-muted-foreground text-center py-8">No categories found.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

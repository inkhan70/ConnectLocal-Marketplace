
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2 } from "lucide-react";
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

interface CustomLanguage {
    code: string;
    name: string;
    dict: object;
}

export default function LanguagesPage() {
    const { toast } = useToast();
    const [langCode, setLangCode] = useState("");
    const [langName, setLangName] = useState("");
    const [langJson, setLangJson] = useState("");
    const [customLanguages, setCustomLanguages] = useState<CustomLanguage[]>([]);

    useEffect(() => {
        const storedLangs = localStorage.getItem("customLanguages");
        if (storedLangs) {
            setCustomLanguages(JSON.parse(storedLangs));
        }
    }, []);

    const handleAddLanguage = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!langCode || !langName || !langJson) {
            toast({ title: "Missing Fields", description: "Please fill out all fields.", variant: "destructive" });
            return;
        }

        try {
            const dictionary = JSON.parse(langJson);
            const newLang: CustomLanguage = { code: langCode, name: langName, dict: dictionary };

            const updatedLangs = [...customLanguages, newLang];
            localStorage.setItem("customLanguages", JSON.stringify(updatedLangs));
            setCustomLanguages(updatedLangs);

            toast({ title: "Language Added", description: `"${langName}" has been saved to your browser.` });
            setLangCode("");
            setLangName("");
            setLangJson("");

            // Dispatch event so other components can update
            window.dispatchEvent(new Event('languageChange'));
            
        } catch (error) {
            toast({ title: "Invalid JSON", description: "The provided dictionary is not valid JSON.", variant: "destructive" });
        }
    };

    const handleRemoveLanguage = (code: string) => {
        const updatedLangs = customLanguages.filter(lang => lang.code !== code);
        localStorage.setItem("customLanguages", JSON.stringify(updatedLangs));
        setCustomLanguages(updatedLangs);
        toast({ title: "Language Removed", description: `The language has been removed.` });
        
        // Dispatch event so other components can update
        window.dispatchEvent(new Event('languageChange'));
    };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-headline">Manage Languages</h1>
        <p className="text-muted-foreground">
          Add or remove custom language dictionaries for the application.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
            <CardHeader>
            <CardTitle>Add a New Language</CardTitle>
            <CardDescription>
                Provide a language code, a display name, and the dictionary in JSON format.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleAddLanguage} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="lang-code">Language Code (e.g., 'pt-BR')</Label>
                    <Input id="lang-code" value={langCode} onChange={e => setLangCode(e.target.value)} placeholder="pt-BR" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="lang-name">Language Name (e.g., 'Português')</Label>
                    <Input id="lang-name" value={langName} onChange={e => setLangName(e.target.value)} placeholder="Português do Brasil" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="lang-json">JSON Dictionary</Label>
                    <Textarea 
                        id="lang-json" 
                        value={langJson} 
                        onChange={e => setLangJson(e.target.value)}
                        placeholder={'{\n  "header.categories": "Categorias",\n  "header.dashboard": "Painel"\n}'}
                        rows={10}
                    />
                </div>
                <Button type="submit">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Language
                </Button>
            </form>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Custom Languages</CardTitle>
                <CardDescription>Languages you have added. These are stored in your browser.</CardDescription>
            </CardHeader>
            <CardContent>
                {customLanguages.length > 0 ? (
                    <ul className="space-y-2">
                        {customLanguages.map(lang => (
                            <li key={lang.code} className="flex items-center justify-between p-2 rounded-md border">
                                <div>
                                    <p className="font-semibold">{lang.name}</p>
                                    <p className="text-sm text-muted-foreground">{lang.code}</p>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="icon">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the <strong>{lang.name}</strong> language from your browser storage.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRemoveLanguage(lang.code)}>
                                            Continue
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No custom languages added yet.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}


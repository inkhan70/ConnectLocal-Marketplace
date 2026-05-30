"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Location } from "@/components/Location";
import { useState, useEffect } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useFirestore, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc, runTransaction, getDoc } from "firebase/firestore";
import type { Category } from '@/app/categories/page';
import { createDefaultUserProfile } from "@/lib/user-utils";
import { getSubcategoriesForCategory, getRoleForSubcategory, getDashboardType } from "@/lib/subcategories";
import type { SubcategoryOption } from "@/lib/subcategories";

interface CategoriesDoc {
    list: Category[];
}

const formSchema = z.object({
  email: z.string().email({ message: "A valid email is required." }).min(1, { message: "Email is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  role: z.enum(["company", "wholesaler", "distributor", "shopkeeper", "services", "buyer"], {
    required_error: "You need to select a role.",
  }),
  businessName: z.string().optional(),
  category: z.string().optional(),
  subcategoryId: z.string().optional(),
  subcategoryName: z.string().optional(),
  fullName: z.string().optional(),
  address: z.string().min(10, { message: "Full address is required." }),
  city: z.string().min(2, { message: "City is required." }),
  state: z.string().min(2, { message: "State is required." }),
}).superRefine((data, ctx) => {
    if (data.role !== 'buyer' && data.role !== 'services' && (!data.businessName || data.businessName.length < 2)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Business name is required and must be at least 2 characters.",
            path: ["businessName"],
        });
    }
    if (data.role !== 'buyer' && (!data.category || data.category.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Business category is required.",
            path: ["category"],
        });
    }
    if (data.role === 'buyer' && (!data.fullName || data.fullName.length < 2)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Full name is required and must be at least 2 characters.",
            path: ["fullName"],
        });
    }
    if (data.role === 'services' && (!data.businessName || data.businessName.length < 2)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Service provider name is required and must be at least 2 characters.",
            path: ["businessName"],
        });
    }
});

export function SignupForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
    const auth = useAuth();
    const firestore = useFirestore();
    
    const categoriesDocRef = useMemoFirebase(() => doc(firestore, 'app_config', 'categories'), [firestore]);
    const { data: categoriesDoc, isLoading: loadingCategories, error } = useDoc<CategoriesDoc>(categoriesDocRef);

    useEffect(() => {
        if (categoriesDoc && categoriesDoc.list && categoriesDoc.list.length > 0) {
            setCategories(categoriesDoc.list.sort((a, b) => a.order - b.order));
        } else if (!loadingCategories) {
             setCategories([]);
        }
    }, [categoriesDoc, loadingCategories]);

    // Load subcategories from URL params if provided
    useEffect(() => {
        const categoryParam = searchParams.get('category');
        const subcategoryParam = searchParams.get('subcategory');
        
        if (categoryParam) {
            form.setValue('category', categoryParam);
            const subs = getSubcategoriesForCategory(categoryParam);
            setSubcategories(subs);
            
            if (subcategoryParam && subs.length > 0) {
                const selected = subs.find(s => s.id === subcategoryParam);
                if (selected) {
                    form.setValue('subcategoryId', selected.id);
                    form.setValue('subcategoryName', selected.name);
                    form.setValue('role', selected.role);
                }
            }
        }
    }, [searchParams]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
            businessName: "",
            fullName: "",
            address: "",
            city: "",
            state: "",
        },
    });

    const selectedRole = form.watch("role");
    const selectedCategory = form.watch("category");

    // Update subcategories when category changes
    useEffect(() => {
        if (selectedCategory) {
            const subs = getSubcategoriesForCategory(selectedCategory);
            setSubcategories(subs);
            if (subs.length > 0) {
                // Auto-select first subcategory if only one option
                if (subs.length === 1) {
                    form.setValue('subcategoryId', subs[0].id);
                    form.setValue('subcategoryName', subs[0].name);
                    form.setValue('role', subs[0].role);
                }
            }
        }
    }, [selectedCategory]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
            const user = userCredential.user;

            const configRef = doc(firestore, "config", "user_count");
            const userRef = doc(firestore, "users", user.uid);
            
            try {
                await runTransaction(firestore, async (transaction) => {
                    const configDoc = await transaction.get(configRef);
                    let isAdmin = false;

                    if (!configDoc.exists()) {
                        transaction.set(configRef, { count: 1 });
                        isAdmin = true;
                    } else {
                        const newCount = configDoc.data().count + 1;
                        transaction.update(configRef, { count: newCount });
                        isAdmin = false;
                    }
                    
                    const newUserProfile = createDefaultUserProfile(user.uid, values.email, values, isAdmin);
                    
                    transaction.set(userRef, newUserProfile);
                });
            } catch (transactionError: any) {
                 if (transactionError.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: userRef.path,
                        operation: 'create', 
                        requestResourceData: { uid: user.uid, email: values.email, role: values.role },
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    throw permissionError;
                }
                throw transactionError;
            }
            
            await sendEmailVerification(user);

            toast({
              title: t('toast.signup_success'),
              description: t('toast.signup_success_desc_verification')
            });

            router.push(`/signin`);

        } catch (error: any) {
            if (error.name === 'FirebaseError' && error.code === 'permission-denied') {
                return;
            }

            let description = "An unexpected error occurred. Please try again.";
            if (error.code === 'auth/email-already-in-use') {
                description = "This email is already registered. Please sign in or use a different email.";
            }

            toast({
                title: "Sign-up Failed",
                description: error.message || description,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-headline">{t('signup.title')}</CardTitle>
        <CardDescription>
          {t('signup.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>{t('signup.role')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder={t('signup.role_placeholder')} />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <SelectItem value="buyer">Buyer / Customer</SelectItem>
                              <SelectItem value="company">{t('signup.role_company')}</SelectItem>
                              <SelectItem value="wholesaler">{t('signup.role_wholesaler')}</SelectItem>
                              <SelectItem value="distributor">{t('signup.role_distributor')}</SelectItem>
                              <SelectItem value="shopkeeper">{t('signup.role_shopkeeper')}</SelectItem>
                              <SelectItem value="services">Service Provider</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                  )}
              />

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('signup.email_label')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('signup.email_placeholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('signup.password')}</FormLabel>
                     <div className="relative">
                      <FormControl>
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                        >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedRole === 'buyer' ? (
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              selectedRole && <div className="space-y-6">
                 <div className="grid md:grid-cols-2 gap-6">
                   <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{selectedRole === 'services' ? 'Service Provider Name' : t('signup.business_name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={selectedRole === 'services' ? 'e.g., John Medical Clinic' : t('signup.business_name_placeholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your primary business category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loadingCategories ? (
                                <div className="p-4 text-center text-sm">Loading categories...</div>
                            ) : categories.length > 0 ? (
                                categories.map(cat => (
                                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                ))
                            ) : (
                                <div className="p-4 text-center text-sm">No categories available.</div>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                 </div>

                 {subcategories.length > 0 && (
                   <FormField
                    control={form.control}
                    name="subcategoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Type</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          const selected = subcategories.find(s => s.id === value);
                          if (selected) {
                            form.setValue('subcategoryName', selected.name);
                            form.setValue('role', selected.role);
                          }
                        }} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your specific business type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {subcategories.map(sub => (
                              <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                 )}
              </div>
            )}
            
              <Location />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('signup.create_account')}
            </Button>
          </form>
        </Form>
        <div className="mt-6 text-center text-sm">
          {t('signup.have_account')}{" "}
          <Link href="/signin" className="font-medium text-primary hover:underline">
            {t('home.sign_in')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Location } from "@/components/Location";
import { useState, useEffect, useMemo } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import * as firebaseAuth from 'firebase/auth';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/firebase";
import { bootstrapUserProfile } from "@/lib/bootstrap-client";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { normalizePhone } from "@/lib/contact";
import { useLiveCategories } from "@/hooks/use-live-categories";
import { categoryKeyFor, childCategories, normText, roleForSelection, topLevelCategories } from "@/lib/category-live";

type SubcategoryOption = { id: string; name: string };

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
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  contactWhatsapp: z.string().optional(),
  fullName: z.string().optional(),
  address: z.string().min(10, { message: "Full address is required." }),
  city: z.string().min(2, { message: "City is required." }),
  state: z.string().min(2, { message: "State is required." }),
}).superRefine((data, ctx) => {
    if (data.role !== 'buyer' && data.contactWhatsapp?.trim()) {
        const phone = normalizePhone(data.contactWhatsapp);
        if (!phone.ok) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: phone.error || "Invalid WhatsApp number.", path: ["contactWhatsapp"] });
        }
    }
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
    if (data.role !== 'buyer' && data.category && !data.subcategoryId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please choose your business type (for example Dentist / Dental Surgeon).",
            path: ["subcategoryId"],
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
    const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
    const auth = useAuth();
    const { signInWithGoogle, isGoogleLoading } = useGoogleAuth("signup", searchParams.get("redirect"));
    
    // Categories come from the live admin list (the same one guests browse), so a new member can only register under a
    // category/business type that the guest pages actually list.
    const { list: liveCategories } = useLiveCategories();
    const categoryOptions = useMemo(
        () => topLevelCategories(liveCategories).map((cat) => ({ key: categoryKeyFor(cat), label: cat.name })),
        [liveCategories],
    );
    const subsFor = (categoryKey: string | null | undefined): SubcategoryOption[] => {
        const parent = topLevelCategories(liveCategories).find((p) => normText(categoryKeyFor(p)) === normText(categoryKey) || normText(p.name) === normText(categoryKey));
        return parent ? childCategories(liveCategories, parent.id).map((c) => ({ id: c.id, name: c.name })) : [];
    };

    // Pre-select category / business type when arriving from a category page (?category=...&subcategory=...).
    useEffect(() => {
        const requested = searchParams.get('category');
        const subcategoryParam = searchParams.get('subcategory');
        const parent = topLevelCategories(liveCategories).find((p) => normText(categoryKeyFor(p)) === normText(requested) || normText(p.name) === normText(requested));
        if (!parent) return;
        const categoryKey = categoryKeyFor(parent);
        form.setValue('category', categoryKey);
        if (isBuyerType(categoryKey)) form.setValue('role', 'buyer', { shouldValidate: true });
        const subs = subsFor(categoryKey);
        setSubcategories(subs);
        const selected = subcategoryParam ? subs.find(s => s.id === subcategoryParam) : undefined;
        if (selected) {
            form.setValue('subcategoryId', selected.id);
            form.setValue('subcategoryName', selected.name);
        }
    }, [searchParams, liveCategories]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
            role: "buyer",
            businessName: "",
            fullName: "",
            address: "",
            city: "",
            state: "",
        },
    });

    const selectedRole = form.watch("role");
    const selectedCategory = form.watch("category");

    // A buyer-type category / business type (Buyer, Customer, Collector, Shopper) makes the member a buyer. Anything else
    // never changes the role: business roles are always chosen explicitly in the "I am signing up as" field.
    const isBuyerType = (categoryKey?: string, subcategoryName?: string) => roleForSelection(categoryKey, subcategoryName) === 'buyer';

    // Update business types when the category changes.
    useEffect(() => {
        if (!selectedCategory) { setSubcategories([]); return; }
        const subs = subsFor(selectedCategory);
        setSubcategories(subs);
        const current = form.getValues('subcategoryId');
        if (current && !subs.some(sub => sub.id === current)) {
            // The previously chosen type belongs to another category: clear it.
            form.setValue('subcategoryId', '');
            form.setValue('subcategoryName', '');
        }
        if (subs.length === 1 && form.getValues('role') !== 'buyer') {
            form.setValue('subcategoryId', subs[0].id, { shouldValidate: true });
            form.setValue('subcategoryName', subs[0].name);
        }
    }, [selectedCategory, liveCategories]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        try {
            const userCredential = await (firebaseAuth as any).createUserWithEmailAndPassword(auth, values.email, values.password);
            const user = userCredential.user;

            // The profile (and, for the very first verified user of a fresh system, admin status) is created by the
            // server from the verified ID token. Nothing privileged is ever written from the browser.
            const profileHints = {
                    role: values.role,
                    businessName: values.businessName,
                    fullName: values.fullName,
                    category: values.category,
                    subcategoryId: values.subcategoryId,
                    subcategoryName: values.subcategoryName,
                    latitude: values.latitude,
                    longitude: values.longitude,
                    contactWhatsapp: values.contactWhatsapp?.trim() || undefined,
                    // The person already chose their role and business type on this form, so the server can send
                    // them straight to the matching dashboard instead of asking again after login.
                    roleSelected: true,
                    address: values.address,
                    city: values.city,
                    state: values.state,
            };
            let profileSaved = false;
            for (let attempt = 0; attempt < 2 && !profileSaved; attempt += 1) {
                try {
                    await bootstrapUserProfile(user, profileHints);
                    profileSaved = true;
                } catch (bootstrapError) {
                    // Retry once; if it still fails the account exists and sign-in re-runs the bootstrap.
                    console.error('Profile bootstrap failed during sign-up:', bootstrapError);
                    await new Promise((resolve) => setTimeout(resolve, 600));
                }
            }

            await (firebaseAuth as any).sendEmailVerification(user);

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
          <Button type="button" variant="outline" className="mb-6 w-full" onClick={signInWithGoogle} disabled={isLoading || isGoogleLoading}>
            {isGoogleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue with Google
          </Button>
          <div className="relative mb-6"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase bg-background px-2 text-muted-foreground">Or</div></div>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('signup.role')}</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value === 'buyer') return; // buyers keep any interest category they pick
                        // Switching to a business role: a buyer-type category no longer applies.
                        if (isBuyerType(form.getValues('category'), form.getValues('subcategoryName'))) {
                          form.setValue('category', '');
                          form.setValue('subcategoryId', '');
                          form.setValue('subcategoryName', '');
                        }
                      }}
                    >
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

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{selectedRole === 'buyer' ? 'Interested in (optional)' : 'Business Category'}</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Only Buyer / Customer / Collector categories change the role (to buyer); business roles are explicit.
                        if (isBuyerType(value)) form.setValue("role", "buyer", { shouldValidate: true });
                        form.setValue("subcategoryId", "");
                        form.setValue("subcategoryName", "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedRole === 'buyer' ? "Choose what you collect or buy (optional)" : "Select a live category"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category.key} value={category.key}>{category.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Categories are managed by the administrator and updated live.</FormDescription>
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


            {selectedRole === 'buyer' && subcategories.length > 0 && (
              <FormField
                control={form.control}
                name="subcategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type (optional)</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(value) => {
                        field.onChange(value);
                        const selected = subcategories.find((sub) => sub.id === value);
                        form.setValue('subcategoryName', selected?.name || '');
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type (e.g. Collector)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                    name="contactWhatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp number (optional)</FormLabel>
                        <FormControl>
                          <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+92 300 1234567" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>Customers will tap WhatsApp / Call to reach this number. Include the country code. You can change it later in Settings.</FormDescription>
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
                        <FormLabel>{selectedRole === "services" ? "Type of Service" : "Business Type"}</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          const selected = subcategories.find(s => s.id === value);
                          if (selected) {
                            form.setValue('subcategoryName', selected.name);
                            if (isBuyerType(selectedCategory || '', selected.name)) form.setValue('role', 'buyer', { shouldValidate: true });
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


"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import * as firebaseAuth from "firebase/auth";
import { useAuth as useFirebaseAuth, useFirestore } from "@/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { UserProfile } from "@/contexts/AuthContext";
import { createDefaultUserProfile } from "@/lib/user-utils";

type User = {
  emailVerified: boolean;
  uid: string;
  email: string | null;
  displayName: string | null;
};

const formSchema = z.object({
  email: z.string().email({
    message: "A valid email is required.",
  }),
  password: z.string().min(1, { message: "Please enter your password." }),
  rememberMe: z.boolean().default(false).optional(),
});

export default function SignInPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectPath = searchParams.get("redirect");
    const { toast } = useToast();
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const auth = useFirebaseAuth();
    const firestore = useFirestore();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
            rememberMe: false,
        },
    });

    const handleResendVerification = async (user: User) => {
        if (!user) return;
        try {
            await (firebaseAuth as any).sendEmailVerification(user);
            toast({ title: t('toast.verification_sent_title'), description: t('toast.verification_sent_desc') });
        } catch (error) {
            console.error("Error resending verification email:", error);
            toast({ title: t('toast.error_sending_verification_title'), description: t('toast.error_sending_verification_desc'), variant: "destructive" });
        }
    }

    async function handleGoogleSignIn() {
        setIsLoading(true);
        try {
            const provider = new (firebaseAuth as any).GoogleAuthProvider();
            const result = await (firebaseAuth as any).signInWithPopup(auth, provider);
            const user = result.user;
            const userDocRef = doc(firestore, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            let userProfile: UserProfile;
            let isNewUser = false;
            
            if (userDocSnap.exists()) {
                userProfile = userDocSnap.data() as UserProfile;
            } else {
                // New user - create profile with buyer role by default
                isNewUser = true;
                userProfile = createDefaultUserProfile(user.uid, user.email || "", { fullName: user.displayName || "Google user", role: "buyer" });
                await setDoc(userDocRef, userProfile);
            }
            
            toast({ title: "Signed in with Google", description: "Welcome back to ConnectLocal." });
            
            // Redirect to role selection if new user, admin to admin dashboard, otherwise to dashboard
            if (userProfile?.isAdmin) {
                router.push("/admin");
            } else if (isNewUser || !userProfile.role || userProfile.needsRoleSelection) {
                const roleUrl = redirectPath ? `/select-role?redirect=${encodeURIComponent(redirectPath)}` : "/select-role";
                router.push(roleUrl);
            } else {
                router.push(redirectPath && redirectPath.startsWith("/") ? redirectPath : "/dashboard");
            }
        } catch (error: any) {
            toast({ title: "Google sign-in failed", description: error.code === "auth/popup-closed-by-user" ? "The sign-in window was closed." : "Please try again.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        try {
            const persistence = values.rememberMe ? (firebaseAuth as any).browserLocalPersistence : (firebaseAuth as any).browserSessionPersistence;
            await (firebaseAuth as any).setPersistence(auth, persistence);
            
            const userCredential = await (firebaseAuth as any).signInWithEmailAndPassword(auth, values.email, values.password);
            const user = userCredential.user;

            if (!user.emailVerified) {
                toast({
                    title: t('toast.email_not_verified_title'),
                    description: t('toast.email_not_verified_desc'),
                    variant: "destructive",
                    action: <Button variant="secondary" onClick={() => handleResendVerification(user)}>{t('toast.resend_verification_button')}</Button>,
                    duration: 10000,
                });
                setIsLoading(false);
                return;
            }

            const userDocRef = doc(firestore, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            let userProfile: UserProfile | null = null;
            let isNewUser = false;

            if (userDocSnap.exists()) {
                userProfile = userDocSnap.data() as UserProfile;
            } else {
                // This is an old user. Create a profile for them on the fly.
                isNewUser = true;
                console.log(`User profile for ${user.uid} not found. Creating a new one.`);
                const newUserProfile = createDefaultUserProfile(user.uid, user.email || '', {
                    fullName: user.displayName || 'New User',
                });
                await setDoc(userDocRef, newUserProfile);
                userProfile = newUserProfile;

                toast({
                    title: "Welcome Back!",
                    description: "We've updated your account to our new system."
                });
            }

            toast({
                title: t('toast.signin_success'),
                description: t('toast.signin_success_desc'),
            });

            // Redirect logic: admin -> admin, new user -> role selection, existing user -> dashboard
            if (userProfile?.isAdmin) {
                router.push("/admin");
            } else if (isNewUser || !userProfile.role || userProfile.needsRoleSelection) {
                const roleUrl = redirectPath ? `/select-role?redirect=${encodeURIComponent(redirectPath)}` : "/select-role";
                router.push(roleUrl);
            } else {
                router.push(redirectPath && redirectPath.startsWith("/") ? redirectPath : "/dashboard");
            }
            
        } catch (error: any) {
            let description = "An unexpected error occurred. Please try again.";
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                description = "Invalid email or password. Please check your details and try again.";
            } else if (error.code === 'auth/too-many-requests') {
                description = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
            }
            toast({
                title: "Sign In Failed",
                description: description,
                variant: "destructive",
            });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

  return (
    <div className="container flex min-h-[calc(100vh-14rem)] items-center justify-center py-12">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">{t('signin.title')}</CardTitle>
          <CardDescription>
            {t('signin.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" className="mb-6 w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
            Continue with Google
          </Button>
          <div className="relative mb-6"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase bg-background px-2 text-muted-foreground">Or</div></div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <div className="flex items-center justify-between">
                        <FormLabel>{t('signin.password')}</FormLabel>
                        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                            {t('signin.forgot_password')}
                        </Link>
                    </div>
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
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        {t('signin.remember_me')}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('signin.button')}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-sm">
            {t('signup.have_account')}{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              {t('home.sign_up')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

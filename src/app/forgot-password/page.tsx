
"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/firebase";
import * as firebaseAuth from "firebase/auth";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

export default function ForgotPasswordPage() {
    const { toast } = useToast();
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const auth = useAuth();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        try {
            await (firebaseAuth as any).sendPasswordResetEmail(auth, values.email);
            toast({
                title: t('toast.reset_link_sent'),
                description: t('toast.reset_link_sent_desc'),
            });
            setIsSent(true);
        } catch (error: any) {
            let description = "An unexpected error occurred. Please try again.";
            if (error.code === 'auth/user-not-found') {
                description = "This email address is not associated with an account.";
            }
            toast({
                title: t('toast.reset_link_failed'),
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
          <CardTitle className="text-2xl font-headline">{t('forgot_password.title')}</CardTitle>
          <CardDescription>
            {isSent ? t('forgot_password.sent_description') : t('forgot_password.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSent ? (
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('forgot_password.button')}
                </Button>
              </form>
            </Form>
          ) : (
             <div className="text-center">
                <p className="text-muted-foreground mb-4">{t('forgot_password.did_not_receive')}</p>
                <Button variant="secondary" onClick={() => form.handleSubmit(onSubmit)()} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('forgot_password.resend_button')}
                </Button>
             </div>
          )}
          <div className="mt-6 text-center text-sm">
            <Link href="/signin" className="flex items-center justify-center gap-2 font-medium text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> {t('forgot_password.back_to_signin')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

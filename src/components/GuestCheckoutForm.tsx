"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "./ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface GuestCheckoutData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  paymentMethod: "cod" | "jazzcash" | "easypaisa" | "stripe" | "paypal";
}

const formSchema = z.object({
  fullName: z.string().min(2), email: z.string().email(), phone: z.string().min(7), address: z.string().min(5), city: z.string().min(2), state: z.string().min(2),
  paymentMethod: z.literal("cod"),
});

type GuestCheckoutFormValues = z.infer<typeof formSchema>;

export function GuestCheckoutForm({ onSubmit, isLoading = false }: { onSubmit: (data: GuestCheckoutData) => Promise<void>; isLoading?: boolean }) {
  const form = useForm<GuestCheckoutFormValues>({ resolver: zodResolver(formSchema), defaultValues: { fullName: "", email: "", phone: "", address: "", city: "", state: "", paymentMethod: "cod" } });
  const [isSubmitting, setIsSubmitting] = useState(false);
  async function handleSubmit(values: GuestCheckoutFormValues) { setIsSubmitting(true); try { await onSubmit(values); } finally { setIsSubmitting(false); } }

  return <Form {...form}><form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
    {([['fullName','Full Name'],['email','Email'],['phone','Phone'],['address','Address'],['city','City'],['state','State']] as const).map(([name,label]) => <FormField key={name} control={form.control} name={name} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type={name === 'email' ? 'email' : 'text'} {...field} /></FormControl><FormMessage /></FormItem>} />)}
    <FormField control={form.control} name="paymentMethod" render={({ field }) => <FormItem><FormLabel>Payment Method</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="cod">Cash on Delivery</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
    <Button type="submit" className="w-full" disabled={isSubmitting || isLoading}>{(isSubmitting || isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue securely</Button>
  </form></Form>;
}


"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";

export default function TermsOfServicePage() {
  const { t } = useLanguage();

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold font-headline leading-tight tracking-tighter text-primary">
              Terms of Service
            </h1>
            <p className="text-lg text-muted-foreground mt-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <p>
              Welcome to business_web! These Terms of Service ("Terms") govern your use of our platform, which connects producers, wholesalers, distributors, shopkeepers (collectively, "Businesses"), and customers ("Buyers"). By creating an account or using our services, you agree to these Terms.
            </p>

            <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">1. User Accounts</h2>
              <p>
                To access most features, you must register for an account. You agree to provide accurate, current, and complete information during the registration process. You are responsible for safeguarding your password and for all activities that occur under your account.
              </p>
              <ul className="list-disc list-inside mt-4 space-y-2">
                <li><strong>Business Accounts:</strong> If you register as a Business, you represent that you are authorized to act on behalf of that entity. You are responsible for all content you post, including product listings, descriptions, and images.</li>
                <li><strong>Buyer Accounts:</strong> If you register as a Buyer, you are responsible for managing your purchase history and account balance.</li>
              </ul>
            </section>
            
            <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">2. Business Responsibilities</h2>
               <ul className="list-disc list-inside mt-4 space-y-2">
                <li><strong>Product Listings:</strong> You agree to provide accurate and truthful information about your products, including names, descriptions, prices, and inventory counts. Misleading or false information is strictly prohibited.</li>
                <li><strong>Order Fulfillment:</strong> You are responsible for fulfilling orders placed by Buyers in a timely and professional manner. Secure product pickup is facilitated by a unique identification number provided for each transaction.</li>
                <li><strong>Compliance:</strong> You agree to comply with all local, state, and federal laws and regulations applicable to your business and products.</li>
              </ul>
            </section>
            
            <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">3. Buyer Rewards & Account Balance</h2>
              <p>
                Our platform offers reward programs to enhance the buyer experience. These programs are subject to change at our discretion.
              </p>
               <ul className="list-disc list-inside mt-4 space-y-2">
                <li><strong>First Purchase Bonus:</strong> New Buyers who complete their first purchase will receive a one-time credit of $5.00 applied to their account balance. This credit can be used for any future purchase on the platform.</li>
                <li><strong>Ghost Coin Program:</strong> Buyers may earn "Ghost Coins" when a seller has an active Ghost Coin offer and the qualifying order is completed. The seller sets the reward and any minimum quantity for the offer.</li>
                <li><strong>Coin Conversion:</strong> Ghost Coins can be converted into account credit using the platform-configured Ghost Coin base value and applicable local-currency exchange rate. Rates may change and are shown before conversion when available.</li>
                <li><strong>No Cash Value:</strong> Account balances and Ghost Coins have no cash value outside of the business_web platform and cannot be withdrawn or transferred.</li>
              </ul>
            </section>
            
             <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">4. Prohibited Conduct</h2>
              <p>
                You agree not to engage in any of the following prohibited activities: using the platform for any illegal purpose, harassing or abusing other users, creating multiple accounts to abuse promotional offers, or interfering with the proper working of the platform.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">5. Termination</h2>
              <p>
                We may terminate or suspend your account at our sole discretion, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the platform will immediately cease.
              </p>
            </section>
            
             <Separator />

             <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">6. Disclaimers and Limitation of Liability</h2>
              <p>
                The platform is provided "as is" without warranties of any kind. business_web is not responsible for the quality, safety, or legality of products sold by Businesses. In no event shall business_web be liable for any indirect, incidental, special, consequential, or punitive damages.
              </p>
            </section>
            
             <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">7. Contact Us</h2>
              <p>
                If you have any questions about these Terms, please <Link href="/contact" className="text-primary underline">contact us</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

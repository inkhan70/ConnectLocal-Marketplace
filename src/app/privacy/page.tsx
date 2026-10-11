
"use client";

import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function PrivacyPolicyPage() {

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold font-headline leading-tight tracking-tighter text-primary">
              Privacy Policy
            </h1>
            <p className="text-lg text-muted-foreground mt-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <p>
              Welcome to business_web. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application. By using our services, you agree to the collection and use of information in accordance with this policy.
            </p>

            <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">1. Information We Collect</h2>
              <p>
                We may collect information about you in a variety of ways. The information we may collect on the platform includes:
              </p>
              <ul className="list-disc list-inside mt-4 space-y-2">
                <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, and address, that you voluntarily give to us when you register with the application.</li>
                <li><strong>Business Data:</strong> If you register as a Business, we collect information related to your business, such as business name, role (producer, wholesaler, etc.), and primary business category.</li>
                <li><strong>Location Data:</strong> We may request access or permission to and track location-based information from your mobile device or browser, either continuously or while you are using the application, to provide location-based services like proximity search.</li>
                <li><strong>Financial Data:</strong> We do not store any credit card information. For account balances and rewards, we only store transactional data such as your balance and Ghost Coin count.</li>
                <li><strong>User-Generated Content:</strong> We collect information you provide when you list products, including descriptions and images, and when you post reviews or communicate with other users via chat.</li>
              </ul>
            </section>
            
            <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">2. How We Use Your Information</h2>
               <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the application to:</p>
               <ul className="list-disc list-inside mt-4 space-y-2">
                <li>Create and manage your account.</li>
                <li>Fulfill and manage purchases, orders, payments, and other transactions.</li>
                <li>Enable user-to-user communications.</li>
                <li>Administer reward programs and promotions.</li>
                <li>Monitor and analyze usage and trends to improve your experience with the application.</li>
                <li>Notify you of updates to the application.</li>
                <li>Offer new products, services, and/or recommendations to you.</li>
                <li>Prevent fraudulent transactions, monitor against theft, and protect against criminal activity.</li>
              </ul>
            </section>
            
            <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">3. Disclosure of Your Information</h2>
              <p>We do not share your personal information with third parties except as described in this Privacy Policy. We may share information we have collected about you in certain situations:</p>
               <ul className="list-disc list-inside mt-4 space-y-2">
                <li><strong>Publicly on the Platform:</strong> Business profiles, including business name, category, and location (city/state), are visible to all users to facilitate browsing and searching. Product listings and reviews are also public.</li>
                <li><strong>Between Users:</strong> To facilitate a transaction, we share necessary information between the Buyer and the Business, such as the unique pickup code for an order.</li>
                <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">4. Security of Your Information</h2>
              <p>
                We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
              </p>
            </section>
            
            <Separator />

             <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">5. Your Rights</h2>
              <p>
                You may at any time review or change the information in your account or terminate your account by accessing your account settings. Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, some information may be retained in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our Terms of Service, and/or comply with legal requirements.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-bold font-headline mb-4 text-foreground">6. Contact Us</h2>
              <p>
                If you have questions or comments about this Privacy Policy, please <Link href="/contact" className="text-primary underline">contact us</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

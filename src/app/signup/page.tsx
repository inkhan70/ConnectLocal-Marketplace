"use client";

import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { SignupForm } from "@/components/SignupForm";

function SignupLoading() {
  return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="container flex items-center justify-center py-12">
      <Suspense fallback={<SignupLoading />}>
        <SignupForm />
      </Suspense>
    </div>
  );
}

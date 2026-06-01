"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import PlanForm from "@/components/PlanForm";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  storageLimit: number;
  listings: number;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function PlanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const firestore = useFirestore();
  const planId = params.planId as string;

  const [isNewPlan] = useState(planId === "new");

  const planDocRef = useMemoFirebase(
    () => (isNewPlan ? null : doc(firestore, "subscriptionPlans", planId)),
    [firestore, planId, isNewPlan]
  );

  const { data: plan, isLoading } = useDoc<SubscriptionPlan>(planDocRef);

  const handleSuccess = (savedPlanId: string) => {
    router.push("/admin/subscriptions/plans");
  };

  const handleCancel = () => {
    router.back();
  };

  if (!isNewPlan && isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/subscriptions/plans">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {isNewPlan ? "Create New Plan" : "Edit Plan"}
        </h1>
      </div>

      <PlanForm
        firestore={firestore}
        initialPlan={plan}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}

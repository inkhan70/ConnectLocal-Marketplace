"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { setDoc, doc, serverTimestamp, Firestore, collection } from "firebase/firestore";

interface SubscriptionPlan {
  id?: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  storageLimit?: number;
  storageLimitBytes?: number;
  storageLimitMB?: number;
  maxImages?: number | null;
  listings?: number | null;
  maxListings?: number | null;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

interface PlanFormProps {
  firestore: Firestore;
  initialPlan?: SubscriptionPlan;
  onSuccess?: (planId: string) => void;
  onCancel?: () => void;
}

export default function PlanForm({
  firestore,
  initialPlan,
  onSuccess,
  onCancel,
}: PlanFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SubscriptionPlan>(
    initialPlan || {
      name: "",
      description: "",
      price: 0,
      features: [""],
      storageLimitMB: 80,
      maxImages: 15,
      listings: 10,
      priority: 0,
    }
  );

  // Normalize older plan documents into the current editable fields.
  useEffect(() => {
    if (initialPlan) {
      const mb = initialPlan.storageLimitBytes ? initialPlan.storageLimitBytes / (1024 * 1024) : (initialPlan.storageLimit || 0) * 1024;
      setFormData((prev) => ({ ...prev, storageLimitMB: mb, maxImages: initialPlan.maxImages ?? null, listings: initialPlan.maxListings ?? initialPlan.listings ?? null }));
    }
  }, [initialPlan]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "price" || name === "storageLimitMB" || name === "maxImages" || name === "listings" || name === "priority"
        ? Number(value)
        : value,
    }));
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData((prev) => ({
      ...prev,
      features: newFeatures,
    }));
  };

  const addFeature = () => {
    setFormData((prev) => ({
      ...prev,
      features: [...prev.features, ""],
    }));
  };

  const removeFeature = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Plan name is required.",
        variant: "destructive",
      });
      return;
    }

    if (formData.price < 0) {
      toast({
        title: "Validation Error",
        description: "Price cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    const activeFeatures = formData.features.filter((f) => f.trim());
    if (activeFeatures.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one feature is required.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const planId = initialPlan?.id || doc(collection(firestore, "subscriptionPlans")).id;
      const planDocRef = doc(firestore, "subscriptionPlans", planId);

      const storageLimitMB = Number(formData.storageLimitMB || 0);
      const maxImages = formData.maxImages === null || formData.maxImages === undefined || Number.isNaN(Number(formData.maxImages)) || Number(formData.maxImages) <= 0 ? null : Number(formData.maxImages);
      const maxListings = formData.listings === null || formData.listings === undefined || Number(formData.listings) <= 0 ? null : Number(formData.listings);
      if (storageLimitMB <= 0) throw new Error('Storage limit must be greater than zero.');
      await setDoc(planDocRef, {
        ...formData,
        storageLimitMB,
        storageLimitBytes: Math.round(storageLimitMB * 1024 * 1024),
        storageLimit: storageLimitMB / 1024,
        maxImages,
        listings: maxListings,
        maxListings,
        features: activeFeatures,
        updatedAt: serverTimestamp(),
        ...((!initialPlan) && { createdAt: serverTimestamp() }),
      });

      toast({
        title: "Success",
        description: initialPlan ? "Plan updated successfully." : "Plan created successfully.",
      });

      if (onSuccess) {
        onSuccess(planId);
      }
    } catch (error) {
      console.error("Error saving plan:", error);
      toast({
        title: "Error",
        description: "Could not save the plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialPlan ? "Edit Subscription Plan" : "Create New Subscription Plan"}</CardTitle>
        <CardDescription>
          {initialPlan ? "Update the details of this subscription plan" : "Define features, pricing, and limitations for this plan"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Basic Information</h3>

            <div>
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Basic, Pro, Enterprise"
                value={formData.name}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Brief description of what this plan offers"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          {/* Pricing & Limits */}
          <div className="space-y-4">
            <h3 className="font-semibold">Pricing & Limits</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Monthly Price ($) *</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="priority">Display Priority</Label>
                <Input
                  id="priority"
                  name="priority"
                  type="number"
                  placeholder="0"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="storageLimitMB">Storage Limit (MB) *</Label>
                <Input id="storageLimitMB" name="storageLimitMB" type="number" placeholder="80" min="1" value={formData.storageLimitMB ?? ""} onChange={handleInputChange} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Canonical storage entitlement for this plan.</p>
              </div>

              <div>
                <Label htmlFor="maxImages">Max Active Images</Label>
                <Input id="maxImages" name="maxImages" type="number" placeholder="15" min="0" value={formData.maxImages == null ? "" : formData.maxImages} onChange={handleInputChange} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for unlimited images.</p>
              </div>

              <div>
                <Label htmlFor="listings">Max Product Listings</Label>
                <Input
                  id="listings"
                  name="listings"
                  type="number"
                  placeholder="5"
                  min="1"
                  value={formData.listings ?? ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum number of products users can list
                </p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Features *</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFeature}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Feature
              </Button>
            </div>

            <div className="space-y-2">
              {formData.features.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Feature ${index + 1}`}
                    value={feature}
                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                    className="flex-1"
                  />
                  {formData.features.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => removeFeature(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                initialPlan ? "Update Plan" : "Create Plan"
              )}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

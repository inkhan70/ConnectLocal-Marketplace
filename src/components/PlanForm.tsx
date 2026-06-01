"use client";

import { useState } from "react";
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
  storageLimit: number;
  listings: number;
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
      storageLimit: 10,
      listings: 5,
      priority: 0,
    }
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "price" || name === "storageLimit" || name === "listings" || name === "priority"
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

      await setDoc(planDocRef, {
        ...formData,
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
                <Label htmlFor="storageLimit">Storage Limit (GB) *</Label>
                <Input
                  id="storageLimit"
                  name="storageLimit"
                  type="number"
                  placeholder="10"
                  min="1"
                  value={formData.storageLimit}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="listings">Max Listings *</Label>
                <Input
                  id="listings"
                  name="listings"
                  type="number"
                  placeholder="5"
                  min="1"
                  value={formData.listings}
                  onChange={handleInputChange}
                  className="mt-1"
                />
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

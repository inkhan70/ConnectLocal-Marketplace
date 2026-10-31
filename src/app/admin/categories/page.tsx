"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronUp, Loader2, MoreHorizontal, Pencil, PlusCircle, Power, Trash2 } from "lucide-react";
import { makeCategorySlug, normalizeCategoryName, type CategoryItem } from "@/lib/category-management";

const iconChoices = [
  "MoreHorizontal",
  "ShoppingBag",
  "UtensilsCrossed",
  "Laptop",
  "Pill",
  "Footprints",
  "Scissors",
  "Gem",
  "Building",
  "Shirt",
  "Home",
  "Car",
  "Wrench",
  "Bone",
  "GlassWater",
];

const defaultIcon = "MoreHorizontal";

export type Category = CategoryItem;

export default function AdminCategoriesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, checking: isAdminChecking } = useIsAdmin();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string>("none");
  const [formMode, setFormMode] = useState<"parent" | "subcategory">("parent");
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState(defaultIcon);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);

  const parentOptions = useMemo(
    () => categories.filter((category) => !category.parentId && category.isActive !== false),
    [categories],
  );

  const groupedSubcategories = useMemo(() => {
    const groups = new Map<string, CategoryItem[]>();
    for (const category of categories) {
      if (!category.parentId) continue;
      const list = groups.get(category.parentId) || [];
      list.push(category);
      groups.set(category.parentId, list);
    }
    return groups;
  }, [categories]);

  const fetchCategories = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin/categories", {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to load categories.");
      const list: CategoryItem[] = Array.isArray(payload.list) ? payload.list : [];
      setCategories(list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
      setMemberCounts(payload.counts && typeof payload.counts === 'object' ? payload.counts : {});
    } catch (error: any) {
      console.error("Failed to load categories:", error);
      toast({ title: "Load failed", description: error.message || "Could not load categories.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const authenticatedRequest = async (method: "POST" | "PUT" | "DELETE", body: Record<string, any>) => {
    if (!user) throw new Error("Administrator authentication is required.");
    const token = await user.getIdToken(true);
    const response = await fetch("/api/admin/categories", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Operation failed.");
    return payload;
  };

  useEffect(() => {
    if (!isAdminChecking && isAdmin && user) {
      void fetchCategories();
    }
  }, [isAdmin, isAdminChecking, user]);

  const resetForm = () => {
    setFormName("");
    setFormIcon(defaultIcon);
    setSelectedParentId("none");
    setFormMode("parent");
    setEditingId(null);
  };

  const startEditing = (category: CategoryItem) => {
    setEditingId(category.id);
    setFormName(category.name);
    setFormIcon(category.icon || defaultIcon);
    setSelectedParentId(category.parentId || "none");
    setFormMode(category.parentId ? "subcategory" : "parent");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formName.trim()) {
      toast({ title: "Missing name", description: "Please enter a category name.", variant: "destructive" });
      return;
    }
    if (!editingId && formMode === "subcategory" && selectedParentId === "none") {
      toast({ title: "Choose a parent", description: "Select an existing parent category before adding a subcategory.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        id: editingId || undefined,
        name: normalizeCategoryName(formName),
        icon: formIcon || defaultIcon,
        slug: makeCategorySlug(formName),
        parentId: formMode === "parent" ? null : selectedParentId === "none" ? null : selectedParentId,
        isActive: true,
      };

      if (editingId) {
        await authenticatedRequest("PUT", payload);
        toast({ title: "Category updated", description: `"${payload.name}" was updated.` });
      } else {
        await authenticatedRequest("POST", payload);
        toast({ title: "Category created", description: `"${payload.name}" was added.` });
      }
      resetForm();
      await fetchCategories();
    } catch (error: any) {
      toast({ title: "Action failed", description: error.message || "Unable to save category.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReorder = async (category: CategoryItem, direction: -1 | 1) => {
    const siblings = categories.filter((item) => (item.parentId || null) === (category.parentId || null)).sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((item) => item.id === category.id);
    const target = siblings[index + direction];
    if (!target) return;
    try {
      setSaving(true);
      await Promise.all([
        authenticatedRequest('PUT', { id: category.id, name: category.name, icon: category.icon, slug: category.slug, parentId: category.parentId || null, isActive: category.isActive !== false, order: target.order }),
        authenticatedRequest('PUT', { id: target.id, name: target.name, icon: target.icon, slug: target.slug, parentId: target.parentId || null, isActive: target.isActive !== false, order: category.order }),
      ]);
      await fetchCategories();
    } catch (error: any) { toast({ title: 'Reorder failed', description: error.message || 'Could not reorder category.', variant: 'destructive' }); } finally { setSaving(false); }
  };

  const handleToggle = async (category: CategoryItem) => {
    try {
      setSaving(true);
      await authenticatedRequest("PUT", {
        id: category.id,
        name: category.name,
        icon: category.icon || defaultIcon,
        slug: category.slug || makeCategorySlug(category.name),
        parentId: category.parentId || null,
        isActive: category.isActive === false,
      });
      toast({
        title: category.isActive === false ? "Category enabled" : "Category disabled",
        description: `"${category.name}" is now ${category.isActive === false ? "active" : "inactive"}.`,
      });
      await fetchCategories();
    } catch (error: any) {
      toast({ title: "Toggle failed", description: error.message || "Could not update category status.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: CategoryItem) => {
    try {
      setSaving(true);
      await authenticatedRequest("DELETE", { id: category.id });
      toast({ title: "Category removed", description: `"${category.name}" was removed.` });
      setDeleteTarget(null);
      await fetchCategories();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message || "Could not remove the category.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isAdminChecking) {
    return (
      <div className="flex min-h-[220px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Administrator access required</CardTitle>
          <CardDescription>You must be signed in as an administrator to manage categories.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manage Categories</h1>
          <p className="text-muted-foreground">Add, edit, delete, enable, and disable categories and subcategories.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <Button type="button" variant="outline" onClick={() => { resetForm(); setFormMode("subcategory"); }} disabled={saving} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Add subcategory
          </Button>
          <Button type="button" onClick={() => { resetForm(); setFormMode("parent"); }} disabled={saving} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Add parent category
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit category" : formMode === "parent" ? "Add parent category" : "Add subcategory"}</CardTitle>
            <CardDescription>{editingId ? "Update the current category or subcategory." : formMode === "parent" ? "Create a new top-level category." : "Create a subcategory under an existing parent."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  placeholder="e.g. Apparel or Tailoring"
                  disabled={saving}
                />
              </div>

              {formMode === "subcategory" && (
                <div className="space-y-2">
                  <Label htmlFor="category-parent">Parent category</Label>
                  <Select value={selectedParentId === "none" ? undefined : selectedParentId} onValueChange={(value) => { setSelectedParentId(value); setFormMode("subcategory"); }} disabled={saving}>
                    <SelectTrigger id="category-parent">
                      <SelectValue placeholder="Select a parent category" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentOptions.filter((category) => category.id !== editingId).map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Choose the parent this subcategory belongs to.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="category-icon">Icon</Label>
                <Select value={formIcon} onValueChange={setFormIcon} disabled={saving}>
                  <SelectTrigger id="category-icon">
                    <SelectValue placeholder="Select icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {iconChoices.map((iconName) => (
                      <SelectItem key={iconName} value={iconName}>
                        {iconName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  {editingId ? "Save changes" : formMode === "parent" ? "Add parent category" : "Add subcategory"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category list</CardTitle>
            <CardDescription>Every category and subcategory is stored in the shared Firestore document.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : categories.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No categories exist yet. Add the first one to the left.</p>
            ) : (
              <div className="space-y-4">
                {categories
                  .filter((category) => !category.parentId)
                  .map((category) => {
                    const children = groupedSubcategories.get(category.id) || [];
                    return (
                      <div key={category.id} className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-background text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{category.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {category.isActive === false ? "Inactive" : "Active"} · Main category · {memberCounts[category.id] || 0} members
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button type="button" variant="ghost" size="icon" onClick={() => void handleReorder(category, -1)} disabled={saving} aria-label={`Move ${category.name} up`}><ChevronUp className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => void handleReorder(category, 1)} disabled={saving} aria-label={`Move ${category.name} down`}><ChevronDown className="h-4 w-4" /></Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => startEditing(category)} disabled={saving}>
                              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button type="button" variant={category.isActive === false ? "secondary" : "outline"} size="sm" onClick={() => void handleToggle(category)} disabled={saving}>
                              <Power className="mr-1 h-3.5 w-3.5" /> {category.isActive === false ? "Enable" : "Disable"}
                            </Button>
                            <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(category)} disabled={saving}>
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 border-t pt-3">
                          {children.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No subcategories yet.</p>
                          ) : (
                            children.map((subcategory) => (
                              <div key={subcategory.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{subcategory.name}</p>
                                  <p className="text-xs text-muted-foreground">{subcategory.isActive === false ? "Inactive" : "Active"} · Subcategory · {memberCounts[subcategory.id] || 0} members</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <Button type="button" variant="ghost" size="icon" onClick={() => void handleReorder(subcategory, -1)} disabled={saving} aria-label={`Move ${subcategory.name} up`}><ChevronUp className="h-4 w-4" /></Button>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => void handleReorder(subcategory, 1)} disabled={saving} aria-label={`Move ${subcategory.name} down`}><ChevronDown className="h-4 w-4" /></Button>
                                  <Button type="button" variant="outline" size="sm" onClick={() => startEditing(subcategory)} disabled={saving}>
                                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                                  </Button>
                                  <Button type="button" variant={subcategory.isActive === false ? "secondary" : "outline"} size="sm" onClick={() => void handleToggle(subcategory)} disabled={saving}>
                                    <Power className="mr-1 h-3.5 w-3.5" /> {subcategory.isActive === false ? "Enable" : "Disable"}
                                  </Button>
                                  <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(subcategory)} disabled={saving}>
                                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}

                          <div className="pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                setEditingId(null);
                                setFormName("");
                                setFormIcon(defaultIcon);
                                setSelectedParentId(category.id);
                                setFormMode("subcategory");
                              }}
                              disabled={saving}
                            >
                              <PlusCircle className="mr-2 h-4 w-4" /> Add subcategory
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.name}. Deleting a parent category also removes its subcategories, and the app will reject deletion if any business, product, service, or listing still references it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  void handleDelete(deleteTarget);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

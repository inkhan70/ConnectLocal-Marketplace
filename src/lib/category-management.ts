export type CategoryItem = {
  id: string;
  name: string;
  icon: string;
  order: number;
  slug?: string;
  parentId?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function normalizeCategoryName(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function makeCategorySlug(value: string): string {
  const normalized = normalizeCategoryName(value).toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'category';
}

export function getCategoryChildren(list: CategoryItem[], parentId: string | null | undefined): CategoryItem[] {
  if (!parentId) return [];
  return list.filter((item) => item.parentId === parentId && item.isActive !== false);
}

export function validateCategoryPayload(
  payload: Partial<CategoryItem>,
  existingList: CategoryItem[] = [],
  currentId?: string | null,
): { category: CategoryItem; error?: undefined } | { category?: undefined; error: string } {
  const rawName = normalizeCategoryName(String(payload.name ?? ''));
  if (!rawName) return { error: 'Category name is required.' };
  if (rawName.length > 80) return { error: 'Category name must be 80 characters or fewer.' };

  const normalizedParentId = payload.parentId && String(payload.parentId).trim() ? String(payload.parentId).trim() : null;
  if (currentId && normalizedParentId === currentId) {
    return { error: 'A category cannot be its own parent.' };
  }

  if (normalizedParentId) {
    const parent = existingList.find((item) => item.id === normalizedParentId);
    if (!parent) return { error: 'Selected parent category was not found.' };
    if (parent.parentId) return { error: 'Subcategories cannot be nested below another subcategory.' };
    if (parent.id === currentId) return { error: 'A category cannot be its own parent.' };
  }

  const normalizedName = rawName.replace(/\s+/g, ' ');
  const duplicate = existingList.some((item) => {
    if (item.id === currentId) return false;
    if (item.parentId !== normalizedParentId) return false;
    return item.name.trim().toLowerCase() === normalizedName.toLowerCase();
  });

  if (duplicate) {
    return { error: 'A category with that name already exists in this section.' };
  }

  const category: CategoryItem = {
    id: String(payload.id ?? currentId ?? `cat_${Date.now()}`),
    name: normalizedName,
    icon: (payload.icon && String(payload.icon).trim()) || 'MoreHorizontal',
    order: Number.isFinite(Number(payload.order)) ? Number(payload.order) : existingList.length + 1,
    slug: String(payload.slug ?? makeCategorySlug(normalizedName)).trim() || makeCategorySlug(normalizedName),
    parentId: normalizedParentId,
    isActive: payload.isActive !== false,
  };

  return { category };
}

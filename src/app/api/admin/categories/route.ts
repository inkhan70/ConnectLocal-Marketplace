import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, requireAdmin, classifyError } from '@/lib/server/firebase-admin';
import { makeCategorySlug, normalizeCategoryName, validateCategoryPayload, type CategoryItem } from '@/lib/category-management';
import { readRealtimeCategories, writeRealtimeCategories } from '@/lib/server/category-rtdb';
import { countMembersByCategory } from '@/lib/category-live';

export const runtime = 'nodejs';

const CATEGORIES_DOCUMENT_ID = 'categories';

async function getCategoryDocument() {
  return { list: await readRealtimeCategories() };
}

async function persistCategories(list: CategoryItem[]) {
  await writeRealtimeCategories(list.map((item) => ({ ...item, parentId: item.parentId || null, isActive: item.isActive !== false, slug: item.slug || makeCategorySlug(item.name) })));
}

async function hasCategoryReferences(db: ReturnType<typeof getAdminDb>, categoryName: string, categoryId?: string, parentId?: string | null) {
  const checks: Array<{ collection: string; field: string; value: string }> = [
    { collection: 'users', field: 'category', value: categoryName },
    { collection: 'products', field: 'category', value: categoryName },
    { collection: 'services', field: 'category', value: categoryName },
    { collection: 'listings', field: 'category', value: categoryName },
  ];

  if (categoryId) {
    checks.push({ collection: 'users', field: 'subcategoryId', value: categoryId });
    checks.push({ collection: 'products', field: 'subcategoryId', value: categoryId });
    checks.push({ collection: 'services', field: 'subcategoryId', value: categoryId });
    checks.push({ collection: 'listings', field: 'subcategoryId', value: categoryId });
  }

  for (const check of checks) {
    const snap = await db.collection(check.collection).where(check.field, '==', check.value).limit(1).get();
    if (!snap.empty) return true;
  }

  if (parentId) {
    const parentSnap = await db.collection('users').where('subcategoryId', '==', parentId).limit(1).get();
    if (!parentSnap.empty) return true;
  }

  return false;
}

function toComparableList(list: CategoryItem[]) {
  return list.map((item) => ({
    ...item,
    name: normalizeCategoryName(item.name),
    slug: item.slug || makeCategorySlug(item.name),
    parentId: item.parentId || null,
    isActive: item.isActive !== false,
  }));
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { list } = await getCategoryDocument();
    // How many members sit under each category, so stale/unused ones are easy to spot and Disable.
    let counts: Record<string, number> = {};
    try {
      const snap = await getAdminDb().collection('users').where('role', 'in', ['company', 'wholesaler', 'distributor', 'shopkeeper', 'services'])
        .select('category', 'categoryId', 'subcategoryId', 'subcategoryName').limit(5000).get();
      counts = countMembersByCategory(list, snap.docs.map((d) => d.data()));
    } catch (error) {
      console.error('Category member counts failed:', error);
    }
    return NextResponse.json({ list: toComparableList(list), counts });
  } catch (error) {
    const result = classifyError(error);
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const { list } = await getCategoryDocument();
    const validation = validateCategoryPayload({
      id: body.id,
      name: body.name,
      slug: body.slug,
      icon: body.icon,
      order: body.order,
      parentId: body.parentId === 'none' || body.parentId === null || body.parentId === undefined ? null : body.parentId,
      isActive: body.isActive,
    }, list, null);

    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const category: CategoryItem = {
      ...validation.category,
      id: validation.category.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: validation.category.name,
      parentId: validation.category.parentId || null,
      isActive: validation.category.isActive !== false,
      slug: validation.category.slug || makeCategorySlug(validation.category.name),
      order: Number.isFinite(Number(validation.category.order)) ? Number(validation.category.order) : list.length + 1,
    };

    const updated = [...list, category];
    await persistCategories(updated);
    return NextResponse.json({ category, list: toComparableList(updated) });
  } catch (error) {
    const result = classifyError(error);
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const { list } = await getCategoryDocument();
    const categoryId = typeof body.id === 'string' ? body.id.trim() : '';
    if (!categoryId) {
      return NextResponse.json({ error: 'Category id is required.' }, { status: 400 });
    }

    const existingIndex = list.findIndex((entry) => entry.id === categoryId);
    if (existingIndex === -1) {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    const current = list[existingIndex];
    const nextCategory = {
      ...current,
      name: body.name !== undefined ? String(body.name) : current.name,
      icon: body.icon !== undefined ? String(body.icon) : current.icon,
      slug: body.slug !== undefined ? String(body.slug) : current.slug || makeCategorySlug(current.name),
      parentId: body.parentId === undefined ? current.parentId : body.parentId === 'none' || body.parentId === null ? null : String(body.parentId),
      isActive: body.isActive !== undefined ? body.isActive !== false : current.isActive !== false,
      order: body.order !== undefined ? Number(body.order) : current.order,
    };

    const validation = validateCategoryPayload(nextCategory, list, categoryId);
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = list.map((entry) => (entry.id === categoryId ? validation.category : entry));
    await persistCategories(updated);
    return NextResponse.json({ category: validation.category, list: toComparableList(updated) });
  } catch (error) {
    const result = classifyError(error);
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const categoryId = typeof body.id === 'string' ? body.id.trim() : '';
    if (!categoryId) {
      return NextResponse.json({ error: 'Category id is required.' }, { status: 400 });
    }

    const db = getAdminDb();
    const { list } = await getCategoryDocument();
    const target = list.find((entry) => entry.id === categoryId);
    if (!target) {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    const deleteIds = new Set<string>([target.id]);
    if (!target.parentId) {
      for (const entry of list) {
        if (entry.parentId === target.id) deleteIds.add(entry.id);
      }
    }

    const candidates = list.filter((entry) => deleteIds.has(entry.id));
    for (const candidate of candidates) {
      const hasRefs = await hasCategoryReferences(db, candidate.name, candidate.id, candidate.parentId);
      if (hasRefs) {
        return NextResponse.json(
          { error: `Cannot delete "${candidate.name}" because existing businesses, products, services, or listings still reference it.` },
          { status: 409 },
        );
      }
    }

    const updated = list.filter((entry) => !deleteIds.has(entry.id));
    await persistCategories(updated);
    return NextResponse.json({ deleted: Array.from(deleteIds), list: toComparableList(updated) });
  } catch (error) {
    const result = classifyError(error);
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
}

import { NextResponse } from 'next/server';
import { classifyError } from '@/lib/server/firebase-admin';
import { makeCategorySlug, normalizeCategoryName, type CategoryItem } from '@/lib/category-management';
import { readRealtimeCategories } from '@/lib/server/category-rtdb';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET() {
  try {
    const list = (await readRealtimeCategories())
      .map((item: CategoryItem) => ({
        ...item,
        name: normalizeCategoryName(item.name),
        slug: item.slug || makeCategorySlug(item.name),
        parentId: item.parentId || null,
        isActive: item.isActive !== false,
      }))
      .filter((item: CategoryItem) => item.isActive !== false)
      .sort((a: CategoryItem, b: CategoryItem) => (a.order ?? 999) - (b.order ?? 999));
    return NextResponse.json({ list }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (error) {
    const result = classifyError(error);
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
}

import { NextResponse } from 'next/server';
import { getAdminDb, classifyError } from '@/lib/server/firebase-admin';
import { makeCategorySlug, normalizeCategoryName, type CategoryItem } from '@/lib/category-management';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET() {
  try {
    const snapshot = await getAdminDb().collection('app_config').doc('categories').get();
    const raw = snapshot.data()?.list;
    const list = (Array.isArray(raw) ? raw : [])
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

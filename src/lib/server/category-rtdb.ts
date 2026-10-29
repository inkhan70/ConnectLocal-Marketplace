import { getAdminRealtimeDb, getAdminDb } from '@/lib/server/firebase-admin';
import { makeCategorySlug, type CategoryItem } from '@/lib/category-management';
import { createDefaultCategoryTaxonomy } from '@/lib/category-taxonomy';

const path = 'categories';

export async function readRealtimeCategories(): Promise<CategoryItem[]> {
  const snapshot = await getAdminRealtimeDb().ref(path).get();
  const value = snapshot.val();
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, any>).map(([id, item]) => ({ id, ...item, parentId: item.parentId || null, isActive: item.enabled !== false && item.isActive !== false, order: Number(item.sortOrder ?? item.order ?? 0) })).sort((a, b) => a.order - b.order);
  }
  return migrateOrSeed();
}

export async function writeRealtimeCategories(list: CategoryItem[]) {
  const updates: Record<string, any> = {};
  for (const item of list) updates[item.id] = { name: item.name, slug: item.slug || makeCategorySlug(item.name), icon: item.icon || 'MoreHorizontal', enabled: item.isActive !== false, isActive: item.isActive !== false, sortOrder: Number(item.order || 0), ...(item.parentId ? { parentId: item.parentId } : {}), updatedAt: Date.now() };
  await getAdminRealtimeDb().ref(path).set(updates);
  await getAdminDb().collection('app_config').doc('categories').set({ list, updatedAt: new Date().toISOString(), source: 'realtime-database' }, { merge: true });
}

async function migrateOrSeed() {
  const firestore = await getAdminDb().collection('app_config').doc('categories').get();
  const legacy = Array.isArray(firestore.data()?.list) ? firestore.data()?.list as CategoryItem[] : [];
  const list = legacy.length ? legacy.map((item) => ({ ...item, parentId: item.parentId || null, isActive: item.isActive !== false })) : createDefaultCategoryTaxonomy();
  await writeRealtimeCategories(list);
  return list;
}

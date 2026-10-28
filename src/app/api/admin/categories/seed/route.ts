import { NextResponse } from 'next/server';
import { requireAdmin, getAdminDb, classifyError } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

const seedCategories = [
  { id: 'food', name: 'Food', slug: 'food', icon: 'UtensilsCrossed', order: 1 },
  { id: 'food-restaurant', name: 'Restaurants', slug: 'restaurants', parentId: 'food', icon: 'UtensilsCrossed', order: 2 },
  { id: 'food-bakery', name: 'Bakery & Desserts', slug: 'bakery-desserts', parentId: 'food', icon: 'UtensilsCrossed', order: 3 },
  { id: 'electronics', name: 'Electronics', slug: 'electronics', icon: 'Laptop', order: 4 },
  { id: 'electronics-mobile', name: 'Mobile & Accessories', slug: 'mobile-accessories', parentId: 'electronics', icon: 'Laptop', order: 5 },
  { id: 'medical', name: 'Medical', slug: 'medical', icon: 'Pill', order: 6 },
  { id: 'medical-pharmacy', name: 'Pharmacies', slug: 'pharmacies', parentId: 'medical', icon: 'Pill', order: 7 },
  { id: 'apparel', name: 'Apparel', slug: 'apparel', icon: 'Shirt', order: 8 },
  { id: 'apparel-shoes', name: 'Shoes & Footwear', slug: 'shoes-footwear', parentId: 'apparel', icon: 'Footprints', order: 9 },
  { id: 'home-garden', name: 'Home & Garden', slug: 'home-garden', icon: 'Home', order: 10 },
  { id: 'automotive', name: 'Automotive', slug: 'automotive', icon: 'Car', order: 11 },
  { id: 'services', name: 'Services', slug: 'services', icon: 'Wrench', order: 12 },
].map((category) => ({ ...category, isActive: true }));

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const ref = getAdminDb().collection('app_config').doc('categories');
    const existing = await ref.get();
    const list = existing.data()?.list;
    if (Array.isArray(list) && list.length > 0) return NextResponse.json({ seeded: false, count: list.length, reason: 'categories_exist' });
    await ref.set({ list: seedCategories, seededAt: new Date().toISOString(), seedVersion: 1 }, { merge: true });
    return NextResponse.json({ seeded: true, count: seedCategories.length });
  } catch (error) {
    const result = classifyError(error);
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
}

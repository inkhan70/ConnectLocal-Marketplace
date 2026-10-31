import { createDefaultCategoryTaxonomy } from '@/lib/category-taxonomy';
import { businessMatchesCategory, placeBusiness, resolveLiveSubcategory, categoryKeyFor, topLevelCategories, childCategories, resolveChosenType, countMembersByCategory } from '@/lib/category-live';
import type { CategoryItem } from '@/lib/category-management';

const base = createDefaultCategoryTaxonomy();
// Admin adds a brand-new category + subcategory that the old hard-coded catalogue has never heard of.
const live: CategoryItem[] = [
  ...base,
  { id: 'cat_x1', name: 'Toys', icon: 'MoreHorizontal', order: 99, slug: 'toys', parentId: null, isActive: true },
  { id: 'cat_x1_sub', name: 'Toy stores', icon: 'MoreHorizontal', order: 1, slug: 'toy-stores', parentId: 'cat_x1', isActive: true },
];

describe('live category pipeline', () => {
  it('a member who registers under an admin-added subcategory shows up for guests', () => {
    const member = { category: 'toys', categoryId: 'cat_x1', subcategoryId: 'cat_x1_sub', subcategoryName: 'Toy stores' };
    expect(businessMatchesCategory(live, member, { categoryParam: 'toys', subcategoryParam: 'cat_x1_sub' })).toBe(true);
    expect(businessMatchesCategory(live, member, { categoryParam: 'toys' })).toBe(true);
    expect(businessMatchesCategory(live, member, { categoryParam: 'food' })).toBe(false);
  });

  it('members saved with an old built-in id still appear under the live subcategory', () => {
    const member = { category: 'medical', subcategoryId: 'health_clinic', subcategoryName: 'Clinic / Diagnostic Center' };
    const placed = placeBusiness(live, member);
    expect(placed.child?.name).toBe('Healthcare providers');
    expect(businessMatchesCategory(live, member, { categoryParam: 'medical', subcategoryParam: placed.child!.id })).toBe(true);
  });

  it('the doctor shortcut (health_doctor) is listed under Medical > Healthcare providers', () => {
    const member = { category: 'medical', subcategoryId: 'health_doctor' };
    const sub = resolveLiveSubcategory(live, 'health_doctor');
    expect(sub?.child.name).toBe('Healthcare providers');
    expect(businessMatchesCategory(live, member, { categoryParam: 'medical', subcategoryParam: sub!.child.id })).toBe(true);
  });

  it('a business in a different subcategory is not shown', () => {
    const member = { category: 'food', subcategoryId: 'cat_1_sub_6', subcategoryName: 'Restaurants and caterers' };
    const other = childCategories(live, 'cat_4')[0];
    expect(businessMatchesCategory(live, member, { categoryParam: 'medical', subcategoryParam: other.id })).toBe(false);
  });

  it('onboarding choices equal what guests see', () => {
    const keys = topLevelCategories(live).map(categoryKeyFor);
    expect(keys).toEqual(expect.arrayContaining(['medical', 'food', 'toys']));
  });

  it('the server accepts an admin-added subcategory and rejects unknown ids', () => {
    const chosen = resolveChosenType(live, 'cat_x1_sub', 'shopkeeper');
    expect(chosen).toMatchObject({ categoryKey: 'toys', categoryId: 'cat_x1', option: { id: 'cat_x1_sub', name: 'Toy stores', dashboardType: 'shopkeeper' } });
    expect(resolveChosenType(live, 'does_not_exist', 'company')).toBeNull();
  });

  it('a disabled (old) category is no longer offered or accepted', () => {
    const hidden = live.map((c) => (c.id === 'cat_1' ? { ...c, isActive: false } : c));
    expect(topLevelCategories(hidden).map((c) => c.id)).not.toContain('cat_1');
    expect(resolveChosenType(hidden, 'cat_1_sub_1', 'company')).toBeNull();
  });

  it('counts members per category for the admin screen', () => {
    const counts = countMembersByCategory(live, [
      { category: 'toys', subcategoryId: 'cat_x1_sub' },
      { category: 'medical', subcategoryId: 'health_clinic' },
    ]);
    expect(counts['cat_x1']).toBe(1);
    expect(counts['cat_x1_sub']).toBe(1);
    expect(counts['cat_4']).toBe(1);
  });
});

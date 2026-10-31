import { createDefaultCategoryTaxonomy } from '@/lib/category-taxonomy';
import { businessMatchesCategory, placeBusiness, resolveLiveSubcategory, categoryKeyFor, topLevelCategories, childCategories } from '@/lib/category-live';
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
});

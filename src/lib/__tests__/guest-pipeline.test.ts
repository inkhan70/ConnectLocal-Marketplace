/** @jest-environment node */
import { createDefaultCategoryTaxonomy } from '@/lib/category-taxonomy';
import { resolveChosenType, businessMatchesCategory, categoryKeyFor, topLevelCategories, childCategories, LEGACY_SUBCATEGORY_ALIASES, filterBusinessesForRequest, findUnplacedMembers, similarName } from '@/lib/category-live';
import { toPublicBusiness } from '@/lib/server/public-profile';

const list = createDefaultCategoryTaxonomy().map((c: any) => ({ ...c, isActive: true, parentId: c.parentId || null }));

const guestLink = (parent: any, sub: any) =>
  `/businesses?category=${encodeURIComponent(parent.name.toLowerCase())}&role=${encodeURIComponent(sub.slug || sub.name.toLowerCase())}&subcategory=${encodeURIComponent(sub.id)}`;
const parse = (url: string) => { const p = new URL('http://x' + url).searchParams; return { categoryParam: p.get('category') || 'all', subcategoryParam: p.get('subcategory') || '' }; };

describe('simulation: member registers -> public API -> guest clicks category/subcategory', () => {
  const failures: string[] = [];
  for (const parent of topLevelCategories(list as any)) {
    for (const sub of childCategories(list as any, parent.id)) {
      for (const role of ['shopkeeper', 'company', 'services']) {
        const chosen = resolveChosenType(list as any, sub.id, role)!;
        const stored = { role, category: chosen.categoryKey, categoryId: chosen.categoryId, subcategoryId: chosen.option.id, subcategoryName: chosen.option.name, businessName: 'B' };
        const pub: any = toPublicBusiness('uid1', stored);
        if (!pub) { failures.push(`${parent.name}/${sub.name}/${role}: dropped by toPublicBusiness`); continue; }
        const req = parse(guestLink(parent, sub));
        if (!businessMatchesCategory(list as any, pub, req)) failures.push(`${parent.name}/${sub.name}/${role}: subcategory link does not match`);
        // Category-level link
        if (!businessMatchesCategory(list as any, pub, { categoryParam: parent.name.toLowerCase() })) failures.push(`${parent.name}/${sub.name}/${role}: category link does not match`);
      }
    }
  }
  test('every default category/subcategory shows its registered members', () => { expect(failures).toEqual([]); });

  test('legacy ids resolve to a live subcategory', () => {
    const missing = Object.keys(LEGACY_SUBCATEGORY_ALIASES).filter((id) => {
      const [slug, name] = LEGACY_SUBCATEGORY_ALIASES[id];
      const p = topLevelCategories(list as any).find((x) => categoryKeyFor(x) === slug);
      return !p || !childCategories(list as any, p.id).some((c) => c.name.toLowerCase() === name.toLowerCase());
    });
    expect(missing).toEqual([]);
  });

  describe('members whose saved type no longer exists in the live list', () => {
    const medical = topLevelCategories(list as any).find((p) => categoryKeyFor(p) === 'medical')!;
    const subs = childCategories(list as any, medical.id);
    const requested = subs[0];
    const link = parse(guestLink(medical, requested));
    const stale = (name: string, extra = {}) => ({ uid: name, role: 'services', category: 'medical', categoryId: medical.id, subcategoryId: 'removed_by_admin', subcategoryName: name, ...extra });
    const placed = { uid: 'placed', role: 'services', category: 'medical', categoryId: medical.id, subcategoryId: subs[1].id, subcategoryName: subs[1].name };

    test('exact members and similarly-named orphans are shown together', () => {
      const exactOne = { ...placed, uid: 'exact', subcategoryId: requested.id, subcategoryName: requested.name };
      const r = filterBusinessesForRequest(list as any, [exactOne, stale(requested.name + ' old'), stale('Totally different'), placed], link);
      expect(r.mode).toBe('exact');
      expect(r.matches.map((m: any) => m.uid).sort()).toEqual(['exact', requested.name + ' old'].sort());
    });

    test('never an empty page when members of the category exist but their type was removed', () => {
      const r = filterBusinessesForRequest(list as any, [stale('Totally different'), placed], link);
      expect(r.mode).toBe('fallback');
      expect(r.fallbackCategoryName).toBe(medical.name);
      expect(r.matches.map((m: any) => m.uid)).toEqual(['Totally different']);
    });

    test('members clearly placed in another subcategory are not shown as a fallback', () => {
      const r = filterBusinessesForRequest(list as any, [placed], link);
      expect(r).toMatchObject({ mode: 'none', matches: [] });
    });

    test('old category keys (health) still reach the live Medical category', () => {
      const r = filterBusinessesForRequest(list as any, [{ uid: 'old', role: 'services', category: 'health', subcategoryId: 'gone', subcategoryName: 'x' }], link);
      expect(r.matches.map((m: any) => m.uid)).toEqual(['old']);
    });

    test('unplaced members are reported to the admin; a malformed link cannot crash the page', () => {
      expect(findUnplacedMembers(list as any, [stale('a'), placed]).map((m: any) => m.uid)).toEqual(['a']);
      expect(() => filterBusinessesForRequest(list as any, [placed], { categoryParam: '%E0%A4%A', subcategoryParam: '%' })).not.toThrow();
      expect(similarName('Restaurants and caterers', 'Restaurant / Cafe')).toBe(true);
    });
  });
});

import { describe, expect, it } from '@jest/globals';
import { makeCategorySlug, normalizeCategoryName, validateCategoryPayload } from '@/lib/category-management';

describe('category management validation', () => {
  it('normalizes names and builds stable slugs', () => {
    expect(normalizeCategoryName('  Home   &  Garden  ')).toBe('Home & Garden');
    expect(makeCategorySlug('Home & Garden')).toBe('home-garden');
  });

  it('rejects duplicate names in the same parent level', () => {
    const list = [
      { id: 'a', name: 'Food', icon: 'UtensilsCrossed', order: 1 },
      { id: 'b', name: 'Electronics', icon: 'Laptop', order: 2 },
    ];

    const result = validateCategoryPayload({ name: 'Food', parentId: null }, list, 'c');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('already exists');
    }
  });

  it('enforces valid parent-child relationships', () => {
    const list = [
      { id: 'parent', name: 'Food', icon: 'UtensilsCrossed', order: 1 },
      { id: 'child', name: 'Bakery', icon: 'UtensilsCrossed', order: 2, parentId: 'parent' },
    ];

    const result = validateCategoryPayload({ name: 'Drinks', parentId: 'child' }, list, 'new-sub');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('cannot be nested');
    }

    const sameParentResult = validateCategoryPayload({ name: 'Bakery', parentId: 'parent' }, list, 'new-other');
    expect('error' in sameParentResult).toBe(true);
  });
});

/**
 * Single source of truth for categories = the live admin list (Realtime Database `categories`, served by
 * GET /api/categories). Onboarding, the server that saves a member's business type, and the guest directory
 * must all read the SAME list, otherwise a member can register under an id the guest pages never ask for
 * and the guest sees "No Businesses Found".
 *
 * The old hard-coded catalogue in `subcategories.ts` is kept ONLY as a read-only alias table so profiles that were
 * saved with an old id (for example `health_clinic`) still resolve to a live subcategory.
 */
import { makeCategorySlug, type CategoryItem } from './category-management';

export const normText = (value: unknown): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const byOrder = (a: CategoryItem, b: CategoryItem) => (a.order ?? 999) - (b.order ?? 999);

export function activeCategories(list: CategoryItem[] | null | undefined): CategoryItem[] {
  return (list || []).filter((item) => item && item.id && item.name && item.isActive !== false);
}

export function topLevelCategories(list: CategoryItem[] | null | undefined): CategoryItem[] {
  return activeCategories(list).filter((item) => !item.parentId).sort(byOrder);
}

export function childCategories(list: CategoryItem[] | null | undefined, parentId: string | null | undefined): CategoryItem[] {
  if (!parentId) return [];
  return activeCategories(list).filter((item) => item.parentId === parentId).sort(byOrder);
}

/** The value stored in `users/{uid}.category`. It is the parent's URL slug (`medical`, `jewelry-gemstones`, ...). */
export function categoryKeyFor(parent: CategoryItem): string {
  return parent.slug || makeCategorySlug(parent.name);
}


/**
 * Old built-in business-type ids -> [category slug, subcategory name] in the default taxonomy.
 * Lets members who registered with an old id (health_clinic, food_restaurant, ...) appear under the live
 * subcategory the guest pages now link to. Unknown ids (e.g. hosp_hotel) simply stay category-only.
 */
export const LEGACY_SUBCATEGORY_ALIASES: Record<string, [string, string]> = {
  health_doctor: ['medical', 'Healthcare providers'], health_clinic: ['medical', 'Healthcare providers'],
  health_hospital: ['medical', 'Healthcare providers'], health_dental: ['medical', 'Healthcare providers'],
  health_dentist: ['medical', 'Healthcare providers'], health_therapy: ['medical', 'Healthcare providers'],
  health_lab: ['medical', 'Healthcare providers'], health_pharmacy: ['medical', 'Pharmacies and retailers'],
  health_pharmaceutical: ['medical', 'Pharmaceutical producers'], health_distributor: ['medical', 'Medical distributors'],
  food_restaurant: ['food', 'Restaurants and caterers'], food_cloud_kitchen: ['food', 'Restaurants and caterers'],
  food_catering: ['food', 'Restaurants and caterers'], hosp_restaurant: ['food', 'Restaurants and caterers'],
  food_wholesaler: ['food', 'Food wholesalers'], food_shop: ['food', 'Grocery retailers'],
  auto_dealership: ['automotive', 'Vehicle retailers'], auto_parts: ['automotive', 'Vehicle retailers'],
  auto_service: ['automotive', 'Automotive repair services'], auto_distributor: ['automotive', 'Automotive distributors'],
  re_broker: ['real-estate', 'Real estate brokers'], re_developer: ['real-estate', 'Property developers'],
  re_landlord: ['real-estate', 'Property management services'],
  svc_plumber: ['services', 'Service providers'], svc_electrician: ['services', 'Service providers'],
  svc_cleaning: ['services', 'Service providers'], svc_tutor: ['services', 'Service providers'],
  svc_consulting: ['services', 'Professional consultants'],
  elec_mobile_laptop_shop: ['electronics', 'Electronics retailers'], elec_shop: ['electronics', 'Electronics retailers'],
  elec_distributor: ['electronics', 'Electronics distributors'], elec_repair: ['electronics', 'Repair services'],
  ap_boutique: ['apparel', 'Clothing retailers'], ap_wholesaler: ['apparel', 'Apparel wholesalers'],
  ap_manufacturer: ['apparel', 'Apparel manufacturers'], ap_tailor: ['apparel', 'Tailoring services'],
  beaut_salon: ['beauty', 'Salons and spas'], beaut_cosmetics: ['beauty', 'Beauty retailers'],
  beaut_distributor: ['beauty', 'Beauty distributors'],
  jew_shop: ['jewelry-gemstones', 'Fine jewelry stores'], jew_maker: ['jewelry-gemstones', 'Jewelry manufacturers'],
  jew_wholesaler: ['jewelry-gemstones', 'Jewelry wholesalers'],
  shoe_shop: ['shoes', 'Shoe retailers'], shoe_manufacturer: ['shoes', 'Shoe manufacturers'],
  shoe_wholesaler: ['shoes', 'Shoe wholesalers'],
  drink_cafe: ['drinks', 'Cafes and retailers'], drink_distributor: ['drinks', 'Beverage distributors'],
  drink_manufacturer: ['drinks', 'Beverage producers'],
  pet_shop: ['pets', 'Pet stores'], pet_vet: ['pets', 'Veterinary services'], pet_grooming: ['pets', 'Pet care agencies'],
};

export type LiveSubcategory = { parent: CategoryItem; child: CategoryItem };

/** Resolves a subcategory id (live id, or an old built-in id) to the live parent/child pair. */
export function resolveLiveSubcategory(list: CategoryItem[] | null | undefined, subcategoryId: string | null | undefined): LiveSubcategory | null {
  const id = String(subcategoryId || '').trim();
  if (!id) return null;
  const all = activeCategories(list);
  const child = all.find((item) => item.id === id && item.parentId);
  if (child) {
    const parent = all.find((item) => item.id === child.parentId);
    return parent ? { parent, child } : null;
  }
  // Old built-in id (health_clinic, food_restaurant, ...): map through the explicit alias table.
  const alias = LEGACY_SUBCATEGORY_ALIASES[id];
  if (!alias) return null;
  const [categorySlug, childName] = alias;
  const wanted = normText(childName);
  const parents = topLevelCategories(all);
  const preferred = parents.find((p) => normText(categoryKeyFor(p)) === normText(categorySlug));
  const pools = preferred ? [preferred, ...parents.filter((p) => p !== preferred)] : parents;
  for (const parent of pools) {
    const match = childCategories(all, parent.id).find((c) => normText(c.name) === wanted);
    if (match) return { parent, child: match };
  }
  return null;
}

type StoredPlacement = { category?: unknown; categoryId?: unknown; subcategoryId?: unknown; subcategoryName?: unknown };

/** Where a stored member profile sits in the live list. `child` is null when only the category is known. */
export function placeBusiness(list: CategoryItem[] | null | undefined, biz: StoredPlacement): { parent: CategoryItem | null; child: CategoryItem | null } {
  const all = activeCategories(list);
  const byId = resolveLiveSubcategory(all, String(biz.subcategoryId || ''));
  if (byId) return { parent: byId.parent, child: byId.child };

  const storedName = normText(biz.subcategoryName);
  const tops = topLevelCategories(all);
  const storedCategory = normText(biz.category);
  const storedCategoryId = String(biz.categoryId || '');
  const parent =
    tops.find((p) => storedCategoryId && p.id === storedCategoryId) ||
    tops.find((p) => storedCategory && [normText(categoryKeyFor(p)), normText(p.name), normText(p.id)].includes(storedCategory)) ||
    null;
  if (storedName) {
    const pool = parent ? childCategories(all, parent.id) : all.filter((c) => c.parentId);
    const child = pool.find((c) => normText(c.name) === storedName);
    if (child) return { parent: parent || all.find((p) => p.id === child.parentId) || null, child };
  }
  return { parent, child: null };
}

/** Does a stored business belong on the guest page for (category, subcategory)? */
export function businessMatchesCategory(
  list: CategoryItem[] | null | undefined,
  biz: StoredPlacement,
  request: { categoryParam?: string; subcategoryParam?: string },
): boolean {
  const all = activeCategories(list);
  const placement = placeBusiness(all, biz);

  const requestedSub = request.subcategoryParam ? resolveLiveSubcategory(all, decodeURIComponent(request.subcategoryParam)) : null;
  if (request.subcategoryParam) {
    if (requestedSub) return placement.child?.id === requestedSub.child.id;
    // Unknown id (deleted subcategory): fall back to exact stored id/name so nothing is silently hidden.
    const wanted = normText(decodeURIComponent(request.subcategoryParam));
    return normText(biz.subcategoryId) === wanted || normText(biz.subcategoryName) === wanted;
  }

  const wantedCategory = normText(decodeURIComponent(request.categoryParam || ''));
  if (!wantedCategory || wantedCategory === 'all') return true;
  const parent = topLevelCategories(all).find((p) => [normText(p.name), normText(categoryKeyFor(p)), normText(p.id)].includes(wantedCategory));
  if (!parent) return normText(biz.category) === wantedCategory;
  return placement.parent?.id === parent.id;
}

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
import { resolveCategoryKey } from './subcategories';

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
  const storedSynonym = storedCategory ? resolveCategoryKey(String(biz.category || '')) || '' : '';
  const parent =
    tops.find((p) => storedCategoryId && p.id === storedCategoryId) ||
    tops.find((p) => storedCategory && [normText(categoryKeyFor(p)), normText(p.name), normText(p.id)].includes(storedCategory)) ||
    // Older profiles use the old category keys (health, food, ...): match the live parent that means the same thing.
    (storedSynonym ? tops.find((p) => (resolveCategoryKey(categoryKeyFor(p)) || resolveCategoryKey(p.name)) === storedSynonym) : null) ||
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

  const requestedSub = request.subcategoryParam ? resolveLiveSubcategory(all, safeDecode(request.subcategoryParam)) : null;
  if (request.subcategoryParam) {
    if (requestedSub) return placement.child?.id === requestedSub.child.id;
    // Unknown id (deleted subcategory): fall back to exact stored id/name so nothing is silently hidden.
    const wanted = normText(safeDecode(request.subcategoryParam));
    return normText(biz.subcategoryId) === wanted || normText(biz.subcategoryName) === wanted;
  }

  const wantedCategory = normText(safeDecode(request.categoryParam || ''));
  if (!wantedCategory || wantedCategory === 'all') return true;
  const parent = topLevelCategories(all).find((p) => [normText(p.name), normText(categoryKeyFor(p)), normText(p.id)].includes(wantedCategory));
  if (!parent) return normText(biz.category) === wantedCategory;
  return placement.parent?.id === parent.id;
}

export type MemberRole = 'buyer' | 'wholesaler' | 'distributor' | 'company' | 'services' | 'shopkeeper';

const BUYER_WORDS = /\b(buyer|customer|collector|shopper)s?\b/;

/**
 * The role a member gets from the category / business type they pick. ONE rule shared by Google sign-up, email
 * sign-up and the server. Buyer-type choices (Buyer, Customer, Collector, Shopper) are checked first and also on the
 * business type, so a "Collector" can never be turned into a shopkeeper or service provider.
 */
export function roleForSelection(categoryName?: string | null, subcategoryName?: string | null): MemberRole {
  const category = normText(categoryName);
  const sub = normText(subcategoryName);
  if (BUYER_WORDS.test(sub) || BUYER_WORDS.test(category)) return 'buyer';
  if (category.includes('wholesale')) return 'wholesaler';
  if (category.includes('distribut')) return 'distributor';
  if (category.includes('producer') || category.includes('company') || category.includes('manufactur')) return 'company';
  if (category.includes('service')) return 'services';
  return 'shopkeeper';
}

/** Dashboard layout for a member, from the category they chose and their role. */
export function dashboardTypeFor(categoryKey: string, role: string): string {
  if (role === 'buyer') return 'buyer';
  if (categoryKey === 'automotive') return 'automotive';
  if (categoryKey === 'medical' && role !== 'services') return 'health';
  if (role === 'shopkeeper') return 'shopkeeper';
  if (role === 'services') return 'services';
  return 'business';
}

export type ChosenType = { categoryKey: string; categoryId: string; categoryName: string; option: { id: string; name: string; role: string; dashboardType: string } };

/** Validates a business-type id against the live list and returns everything the server stores for the member. */
export function resolveChosenType(list: CategoryItem[] | null | undefined, subcategoryId: string | null | undefined, role: string): ChosenType | null {
  const live = resolveLiveSubcategory(list, subcategoryId);
  if (!live) return null;
  const categoryKey = categoryKeyFor(live.parent);
  return { categoryKey, categoryId: live.parent.id, categoryName: live.parent.name, option: { id: live.child.id, name: live.child.name, role, dashboardType: dashboardTypeFor(categoryKey, role) } };
}

/** Number of members placed under each live category/subcategory id (used by the admin screen). */
export function countMembersByCategory(list: CategoryItem[] | null | undefined, members: StoredPlacement[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const member of members) {
    const { parent, child } = placeBusiness(list, member);
    if (parent) counts[parent.id] = (counts[parent.id] || 0) + 1;
    if (child) counts[child.id] = (counts[child.id] || 0) + 1;
  }
  return counts;
}

const STOP = new Set(['and', 'the', 'for', 'with', 'shop', 'shops', 'store', 'stores', 'services', 'service', 'other', 'general']);
const tokens = (v: unknown) => normText(v).split(' ').map((t) => t.replace(/s$/, '')).filter((t) => t.length > 2 && !STOP.has(t));
/** True when two business-type names share a meaningful word ("Restaurants and caterers" ~ "Restaurant / Cafe"). */
export function similarName(a: unknown, b: unknown): boolean {
  const left = new Set(tokens(a));
  return tokens(b).some((t) => left.has(t));
}

export type DirectoryResult<T> = { matches: T[]; mode: 'exact' | 'fallback' | 'none'; fallbackCategoryName?: string };

/**
 * What a guest sees after clicking a category (and subcategory).
 *  - exact:    members placed in that subcategory (plus members whose saved type no longer exists but has a similar name)
 *  - fallback: nobody matches exactly, so show the members of the same category whose saved business type can no longer
 *              be found in the live list (renamed / removed by the admin) instead of an empty page. Members that are
 *              clearly in a DIFFERENT subcategory are never shown here.
 */
export function filterBusinessesForRequest<T extends StoredPlacement>(
  list: CategoryItem[] | null | undefined,
  businesses: T[],
  request: { categoryParam?: string; subcategoryParam?: string },
): DirectoryResult<T> {
  const all = activeCategories(list);
  const requested = request.subcategoryParam ? resolveLiveSubcategory(all, safeDecode(request.subcategoryParam)) : null;

  if (!request.subcategoryParam || !requested) {
    const matches = businesses.filter((biz) => businessMatchesCategory(all, biz, request));
    return { matches, mode: matches.length ? 'exact' : 'none' };
  }

  const { parent, child } = requested;
  const exact: T[] = [];
  const orphans: T[] = [];
  for (const biz of businesses) {
    const placed = placeBusiness(all, biz);
    if (placed.child?.id === child.id) { exact.push(biz); continue; }
    if (!placed.child && placed.parent?.id === parent.id) orphans.push(biz);
  }
  const similarOrphans = orphans.filter((biz) => similarName(biz.subcategoryName, child.name));
  if (exact.length || similarOrphans.length) return { matches: [...exact, ...similarOrphans], mode: 'exact' };
  if (orphans.length) return { matches: orphans, mode: 'fallback', fallbackCategoryName: parent.name };
  return { matches: [], mode: 'none' };
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

/** Members whose saved business type does not map to any live subcategory (for the admin to review). */
export function findUnplacedMembers<T extends StoredPlacement>(list: CategoryItem[] | null | undefined, members: T[]): T[] {
  return members.filter((member) => !placeBusiness(list, member).child);
}

import { normalizePhone } from '@/lib/contact';
import { resolveCategoryKey } from '@/lib/subcategories';

/**
 * Public projection of a member profile.
 *
 * `users/{uid}` documents hold private data (email, phone, balances, Stripe ids, admin flag, permissions...). They are
 * NOT readable by other members. Everything the public directory, search, storefront and chat screens need goes
 * through these helpers, which copy ONLY an explicit allow-list of fields.
 */
export const PUBLIC_BUSINESS_ROLES = ['company', 'wholesaler', 'distributor', 'shopkeeper', 'services'] as const;

export const PUBLIC_PROFILE_FIELDS = [
  'uid', 'businessName', 'fullName', 'role', 'category', 'subcategoryId', 'subcategoryName', 'dashboardType',
  'address', 'city', 'state', 'countryCode', 'latitude', 'longitude', 'storefrontWallpaper', 'slogan',
  'businessDescription', 'createdAt', 'currencyCode',
  // Public Ghost Coin offer shown on product pages
  'ghostCoinRewardPerSale', 'ghostCoinMinimumQuantity', 'ghostCoinOfferEnabled', 'ghostCoinsPerSale', 'ghostCoinMinQuantity',
  // Fulfilment options the buyer needs to know about
  'pickupEnabled', 'deliveryEnabled',
  // Contact numbers the member deliberately published for customers (validated/normalised below).
  'contactWhatsapp', 'contactPhone', 
] as const;

export type PublicProfile = Partial<Record<(typeof PUBLIC_PROFILE_FIELDS)[number], any>> & { uid: string };

function toIso(value: any): any {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  return value;
}

/** Returns the public view of a profile, or null when the account is not a public business (buyers, admins). */
export function toPublicBusiness(id: string, data: Record<string, any> | undefined): PublicProfile | null {
  if (!data) return null;
  if (data.isAdmin === true) return null;
  if (!(PUBLIC_BUSINESS_ROLES as readonly string[]).includes(String(data.role))) return null;
  const out: Record<string, any> = { uid: id };
  for (const field of PUBLIC_PROFILE_FIELDS) {
    if (field === 'uid') continue;
    if (data[field] === undefined) continue;
    if (field === 'contactWhatsapp' || field === 'contactPhone') {
      // Only valid numbers are published; junk never becomes a broken link.
      const phone = normalizePhone(data[field], data.countryCode);
      if (phone.ok) out[field] = phone.e164;
      continue;
    }
    if (field === 'category') {
      out[field] = resolveCategoryKey(String(data[field] || '')) || data[field];
    } else {
      out[field] = field === 'createdAt' ? toIso(data[field]) : data[field];
    }
  }
  // Legacy profiles may have the business type in the name but no saved subcategory.
  // Expose a stable label so guest search and category pages do not fall back to the role.
  if (!out.subcategoryName) {
    const text = `${out.businessName || ''} ${out.fullName || ''}`.toLowerCase();
    if (/cafe|restaurant/.test(text)) out.subcategoryName = 'Cafe / Restaurant';
  }
  return out as PublicProfile;
}

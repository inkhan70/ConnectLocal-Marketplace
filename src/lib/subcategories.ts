// Dynamic subcategories for each current marketplace category.
// Legacy role values remain supported for dashboard compatibility; admin privileges are unchanged.
import { createDefaultCategoryTaxonomy } from './category-taxonomy';


export interface SubcategoryOption {
  id: string;
  name: string;
  role: 'company' | 'wholesaler' | 'distributor' | 'shopkeeper' | 'services';
  dashboardType: string; // Type of dashboard layout to use
}

const legacySubcategoriesMap: Record<string, SubcategoryOption[]> = {
  // Medical & Healthcare
  medical: [
    {
      id: 'health_doctor',
      name: 'Doctor / Medical Professional',
      role: 'services',
      dashboardType: 'services',
    },
    {
      id: 'health_clinic',
      name: 'Clinic / Diagnostic Center',
      role: 'company',
      dashboardType: 'health',
    },
    {
      id: 'health_hospital',
      name: 'Hospital',
      role: 'company',
      dashboardType: 'health',
    },
    {
      id: 'health_pharmacy',
      name: 'Medical Store / Pharmacy',
      role: 'shopkeeper',
      dashboardType: 'health',
    },
    {
      id: 'health_dental',
      name: 'Dental Clinic',
      role: 'company',
      dashboardType: 'health',
    },
    {
      id: 'health_dentist',
      name: 'Dentist / Dental Surgeon',
      role: 'services',
      dashboardType: 'services',
    },
    {
      id: 'health_therapy',
      name: 'Physical Therapy / Rehabilitation',
      role: 'services',
      dashboardType: 'services',
    },
    {
      id: 'health_pharmaceutical',
      name: 'Pharmaceutical Company',
      role: 'company',
      dashboardType: 'health',
    },
    {
      id: 'health_distributor',
      name: 'Medical Distributor',
      role: 'distributor',
      dashboardType: 'health',
    },
    {
      id: 'health_lab',
      name: 'Diagnostic Lab',
      role: 'company',
      dashboardType: 'health',
    },
  ],

  // Food & Beverage
  food: [
    {
      id: 'food_restaurant',
      name: 'Restaurant / Cafe',
      role: 'company',
      dashboardType: 'food',
    },
    {
      id: 'food_cloud_kitchen',
      name: 'Cloud Kitchen',
      role: 'company',
      dashboardType: 'food',
    },
    {
      id: 'food_catering',
      name: 'Catering Service',
      role: 'services',
      dashboardType: 'services',
    },
    {
      id: 'food_wholesaler',
      name: 'Food Wholesaler',
      role: 'wholesaler',
      dashboardType: 'food',
    },
    {
      id: 'food_shop',
      name: 'Food Shop / Bakery',
      role: 'shopkeeper',
      dashboardType: 'food',
    },
  ],

  // Automotive
  automotive: [
    {
      id: 'auto_dealership',
      name: 'Car Dealership / Showroom',
      role: 'company',
      dashboardType: 'automotive',
    },
    {
      id: 'auto_parts',
      name: 'Auto Parts Store',
      role: 'shopkeeper',
      dashboardType: 'automotive',
    },
    {
      id: 'auto_service',
      name: 'Auto Repair / Service Center',
      role: 'services',
      dashboardType: 'services',
    },
    {
      id: 'auto_distributor',
      name: 'Auto Distributor',
      role: 'distributor',
      dashboardType: 'automotive',
    },
  ],

  // Real Estate
  'real-estate': [
    {
      id: 're_broker',
      name: 'Real Estate Broker / Agent',
      role: 'services',
      dashboardType: 'realestate',
    },
    {
      id: 're_developer',
      name: 'Property Developer',
      role: 'company',
      dashboardType: 'realestate',
    },
    {
      id: 're_landlord',
      name: 'Landlord / Property Owner',
      role: 'company',
      dashboardType: 'realestate',
    },
  ],

  // Hospitality & Tourism
  'home-&-garden': [
    {
      id: 'hosp_hotel',
      name: 'Hotel / Resort',
      role: 'company',
      dashboardType: 'hospitality',
    },
    {
      id: 'hosp_guest_house',
      name: 'Guest House / Homestay',
      role: 'company',
      dashboardType: 'hospitality',
    },
    {
      id: 'hosp_restaurant',
      name: 'Restaurant / Bar',
      role: 'company',
      dashboardType: 'hospitality',
    },
  ],

  // Services
  services: [
    {
      id: 'svc_plumber',
      name: 'Plumbing Services',
      role: 'services',
      dashboardType: 'services',
    },
    {
      id: 'svc_electrician',
      name: 'Electrical Services',
      role: 'services',
      dashboardType: 'services',
    },
    {
      id: 'svc_cleaning',
      name: 'Cleaning Services',
      role: 'services',
      dashboardType: 'services',
    },
    {
      id: 'svc_tutor',
      name: 'Tutoring / Education Services',
      role: 'services',
      dashboardType: 'services',
    },
    {
      id: 'svc_consulting',
      name: 'Consulting Services',
      role: 'services',
      dashboardType: 'services',
    },
  ],

  // Electronics
  electronics: [
    {
      id: 'elec_shop',
      name: 'Electronics Retail Store',
      role: 'shopkeeper',
      dashboardType: 'electronics',
    },
    {
      id: 'elec_distributor',
      name: 'Electronics Distributor',
      role: 'distributor',
      dashboardType: 'electronics',
    },
    {
      id: 'elec_repair',
      name: 'Electronics Repair Service',
      role: 'services',
      dashboardType: 'services',
    },
  ],

  // Apparel & Fashion
  apparel: [
    {
      id: 'ap_boutique',
      name: 'Boutique / Clothing Store',
      role: 'shopkeeper',
      dashboardType: 'apparel',
    },
    {
      id: 'ap_wholesaler',
      name: 'Apparel Wholesaler',
      role: 'wholesaler',
      dashboardType: 'apparel',
    },
    {
      id: 'ap_manufacturer',
      name: 'Clothing Manufacturer',
      role: 'company',
      dashboardType: 'apparel',
    },
    {
      id: 'ap_tailor',
      name: 'Tailoring Services',
      role: 'services',
      dashboardType: 'services',
    },
  ],

  // Beauty & Personal Care
  beauty: [
    {
      id: 'beaut_salon',
      name: 'Salon / Spa',
      role: 'company',
      dashboardType: 'services',
    },
    {
      id: 'beaut_cosmetics',
      name: 'Cosmetics Store',
      role: 'shopkeeper',
      dashboardType: 'beauty',
    },
    {
      id: 'beaut_distributor',
      name: 'Beauty Products Distributor',
      role: 'distributor',
      dashboardType: 'beauty',
    },
  ],

  // Jewelry
  jewelry: [
    {
      id: 'jew_shop',
      name: 'Jewelry Store',
      role: 'shopkeeper',
      dashboardType: 'jewelry',
    },
    {
      id: 'jew_maker',
      name: 'Jewelry Maker / Jeweler',
      role: 'company',
      dashboardType: 'jewelry',
    },
    {
      id: 'jew_wholesaler',
      name: 'Jewelry Wholesaler',
      role: 'wholesaler',
      dashboardType: 'jewelry',
    },
  ],

  // Shoes & Footwear
  shoes: [
    {
      id: 'shoe_shop',
      name: 'Shoe Store',
      role: 'shopkeeper',
      dashboardType: 'apparel',
    },
    {
      id: 'shoe_manufacturer',
      name: 'Shoe Manufacturer',
      role: 'company',
      dashboardType: 'apparel',
    },
    {
      id: 'shoe_wholesaler',
      name: 'Shoe Wholesaler',
      role: 'wholesaler',
      dashboardType: 'apparel',
    },
  ],

  // Drinks
  drinks: [
    {
      id: 'drink_cafe',
      name: 'Coffee / Beverage Shop',
      role: 'shopkeeper',
      dashboardType: 'food',
    },
    {
      id: 'drink_distributor',
      name: 'Beverage Distributor',
      role: 'distributor',
      dashboardType: 'food',
    },
    {
      id: 'drink_manufacturer',
      name: 'Beverage Manufacturer',
      role: 'company',
      dashboardType: 'food',
    },
  ],

  // Pets
  pets: [
    {
      id: 'pet_shop',
      name: 'Pet Shop',
      role: 'shopkeeper',
      dashboardType: 'pets',
    },
    {
      id: 'pet_vet',
      name: 'Veterinary Clinic',
      role: 'services',
      dashboardType: 'services',
    },
    {
      id: 'pet_grooming',
      name: 'Pet Grooming Service',
      role: 'services',
      dashboardType: 'services',
    },
  ],
};

const roleForName = (name: string): SubcategoryOption['role'] => {
  const value = name.toLowerCase();
  if (/service|repair|agency|consult|management|clinic|hospital|pharmacy|veterinary|salon|spa|lapidary|tailor|restaurant|cafe|cater/.test(value)) return 'services';
  if (/distributor/.test(value)) return 'distributor';
  if (/wholesale/.test(value)) return 'wholesaler';
  if (/broker/.test(value)) return 'company';
  if (/retail|shop|store/.test(value)) return 'shopkeeper';
  return 'company';
};

export const subcategoriesMap: Record<string, SubcategoryOption[]> = (() => {
  const taxonomy = createDefaultCategoryTaxonomy();
  const result: Record<string, SubcategoryOption[]> = {};
  for (const item of taxonomy.filter((entry) => entry.parentId)) {
    const parent = taxonomy.find((entry) => entry.id === item.parentId);
    const categoryKey = parent?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'services';
    (result[categoryKey] ||= []).push({ id: item.id, name: item.name, role: roleForName(item.name), dashboardType: categoryKey });
  }
  return result;
})();

// Preserve legacy lookups only when an administrator has not yet seeded the new taxonomy.
for (const [key, options] of Object.entries(legacySubcategoriesMap)) {
  if (!subcategoriesMap[key]?.length) subcategoriesMap[key] = options;
}
subcategoriesMap.jewelry = subcategoriesMap['jewelry-gemstones'];
subcategoriesMap['home-&-garden'] = subcategoriesMap['home-garden'];

// Get subcategories for a category
export function getSubcategoriesForCategory(
  categoryName: string
): SubcategoryOption[] {
  const key = resolveCategoryKey(categoryName);
  return key ? subcategoriesMap[key] || [] : [];
}

/**
 * Maps ANY category identifier (the built-in key such as "medical", the label "Medical & Healthcare", or a name an
 * administrator typed into the categories editor such as "Medical", "Healthcare", "Jewellery") to a key of
 * `subcategoriesMap`. Returns null when nothing matches.
 */
export function resolveCategoryKey(nameOrKey: string | null | undefined): string | null {
  const raw = String(nameOrKey || '').trim().toLowerCase();
  if (!raw) return null;
  if (subcategoriesMap[raw]) return subcategoriesMap[raw] ? raw : null;
  const norm = raw.replace(/[^a-z0-9]+/g, ' ').trim();
  const keys = Object.keys(subcategoriesMap);
  // exact label match
  for (const key of keys) {
    const label = (CATEGORY_LABELS[key] || key).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (label === norm) return key;
  }
  // synonyms an administrator might use
  const synonyms: Array<[RegExp, string]> = [
    [/medic|health|doctor|pharma|dental|clinic|hospital/, 'medical'],
    [/food|restaurant|bakery|grocery|cafe/, 'food'],
    [/auto|car|vehicle|motor/, 'automotive'],
    [/service|professional|repair|consult/, 'services'],
    [/electronic|mobile|computer|appliance/, 'electronics'],
    [/apparel|cloth|fashion|garment/, 'apparel'],
    [/beauty|cosmetic|salon|personal care/, 'beauty'],
    [/jewel|gold/, 'jewelry'],
    [/shoe|footwear/, 'shoes'],
    [/drink|beverage|juice/, 'drinks'],
    [/pet|animal/, 'pets'],
    [/real estate|property|realty|estate/, 'real-estate'],
    [/home|garden|furniture|decor/, 'home-&-garden'],
  ];
  for (const [pattern, key] of synonyms) {
    if (pattern.test(norm) && subcategoriesMap[key]) return key;
  }
  return null;
}

/** The built-in business categories (always available, even when the admin category list is empty). */
export function getBuiltInCategories(): Array<{ key: string; label: string }> {
  return Object.keys(subcategoriesMap).map((key) => ({ key, label: CATEGORY_LABELS[key] || key }));
}

// Get dashboard type for a subcategory
export function getDashboardType(subcategoryId: string): string {
  for (const subcategories of Object.values(subcategoriesMap)) {
    const sub = subcategories.find((s) => s.id === subcategoryId);
    if (sub) return sub.dashboardType;
  }
  return 'generic';
}

// Get role for a subcategory
export function getRoleForSubcategory(subcategoryId: string): string {
  for (const subcategories of Object.values(subcategoriesMap)) {
    const sub = subcategories.find((s) => s.id === subcategoryId);
    if (sub) return sub.role;
  }
  return 'shopkeeper';
}

// Human-readable names for the category keys used in `subcategoriesMap` (used by the post-login business-type step).
export const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Medical & Healthcare',
  food: 'Food & Restaurants',
  automotive: 'Automotive',
  services: 'Professional Services',
  electronics: 'Electronics',
  apparel: 'Apparel & Clothing',
  beauty: 'Beauty & Personal Care',
  jewelry: 'Jewelry',
  shoes: 'Shoes & Footwear',
  drinks: 'Drinks & Beverages',
  pets: 'Pets',
  'real-estate': 'Real Estate & Property',
  'home-&-garden': 'Home & Garden',
};

/** Finds a business type by id and returns it with the category key it belongs to (or null if unknown). */
export function findSubcategory(subcategoryId: string): { categoryKey: string; option: SubcategoryOption } | null {
  for (const [categoryKey, options] of Object.entries(subcategoriesMap)) {
    const option = options.find((s) => s.id === subcategoryId);
    if (option) return { categoryKey, option };
  }
  return null;
}

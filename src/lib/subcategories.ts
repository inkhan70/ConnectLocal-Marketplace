// Subcategories for each main category
// Maps main category -> list of business types with their dashboard requirements

export interface SubcategoryOption {
  id: string;
  name: string;
  role: 'company' | 'wholesaler' | 'distributor' | 'shopkeeper' | 'services';
  dashboardType: string; // Type of dashboard layout to use
}

export const subcategoriesMap: Record<string, SubcategoryOption[]> = {
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

// Get subcategories for a category
export function getSubcategoriesForCategory(
  categoryName: string
): SubcategoryOption[] {
  const key = categoryName.toLowerCase().replace(/\s+/g, '-');
  return subcategoriesMap[key] || [];
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

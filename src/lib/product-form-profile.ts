/**
 * Per-business-type wording and behaviour of the "add product" form.
 *
 * Shopkeepers, wholesalers and similar sellers keep the original stock-based form (mode "goods", unchanged).
 * Service providers (doctors, dentists, therapists, repair services, ...) list SERVICES: they get service wording, no
 * inventory / low-stock fields, and their listings are never limited by stock. Nothing else in the app changes.
 */
export type ProductFormMode = 'goods' | 'service';

export interface ProductFormProfile {
  mode: ProductFormMode;
  addTitle: string; editTitle: string; addDescription: string; editDescription: string;
  nameLabel: string; namePlaceholder: string; descriptionPlaceholder: string;
  varietiesTitle: string; varietyNameLabel: string; varietyNamePlaceholder: string; priceLabel: string;
  addVariety: string; submitCreate: string; created: string; updated: string;
}

const GOODS: ProductFormProfile = {
  mode: 'goods',
  addTitle: 'Add a New Product', editTitle: 'Edit Product',
  addDescription: 'Fill out the form to add a new item to your inventory.', editDescription: 'Update the details for your existing product.',
  nameLabel: 'Product Name / Brand', namePlaceholder: 'e.g., Artisan Sourdough Bread',
  descriptionPlaceholder: 'Provide a detailed description of the product brand...',
  varietiesTitle: 'Product Varieties', varietyNameLabel: 'Variety Name', varietyNamePlaceholder: 'e.g., Classic White', priceLabel: 'Price ($)',
  addVariety: 'Add Another Variety', submitCreate: 'Create Product', created: 'Product Created', updated: 'Product Updated',
};

const SERVICE: ProductFormProfile = {
  mode: 'service',
  addTitle: 'Add a New Service', editTitle: 'Edit Service',
  addDescription: 'List a service you offer (for example a consultation, procedure or package) so customers can find and book you.',
  editDescription: 'Update the details of your service.',
  nameLabel: 'Service Name', namePlaceholder: 'e.g., Dental Check-up & Cleaning',
  descriptionPlaceholder: 'Describe what is included, how long it takes and who it is for...',
  varietiesTitle: 'Service Options & Fees', varietyNameLabel: 'Option Name', varietyNamePlaceholder: 'e.g., Consultation, Root canal treatment', priceLabel: 'Fee ($)',
  addVariety: 'Add Another Option', submitCreate: 'Create Service', created: 'Service Created', updated: 'Service Updated',
};

export function getProductFormProfile(profile?: { role?: string; dashboardType?: string } | null): ProductFormProfile {
  const isService = profile?.role === 'services' || profile?.dashboardType === 'services';
  return isService ? SERVICE : GOODS;
}

/** Stock value stored for services (hidden from the form; `trackInventory: false` is what the server honours). */
export const SERVICE_INVENTORY_PLACEHOLDER = 9999;

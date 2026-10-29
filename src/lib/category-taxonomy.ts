import type { CategoryItem } from './category-management';

const groups: Record<string, string[]> = {
  Food: ['Food producers', 'Food manufacturers', 'Food distributors', 'Food wholesalers', 'Grocery retailers', 'Restaurants and caterers', 'Food brokers'],
  Drinks: ['Beverage producers', 'Breweries and wineries', 'Beverage distributors', 'Beverage wholesalers', 'Cafes and retailers', 'Bartending services', 'Beverage brokers'],
  Electronics: ['Electronics manufacturers', 'Component producers', 'Electronics distributors', 'Electronics wholesalers', 'Electronics retailers', 'Repair services', 'Technology agencies', 'Electronics brokers'],
  Medical: ['Medical manufacturers', 'Pharmaceutical producers', 'Medical distributors', 'Medical wholesalers', 'Pharmacies and retailers', 'Healthcare providers', 'Medical agencies', 'Medical equipment brokers'],
  Shoes: ['Shoe manufacturers', 'Leather and footwear producers', 'Shoe distributors', 'Shoe wholesalers', 'Shoe retailers', 'Shoe repair services', 'Footwear brokers'],
  Beauty: ['Cosmetics manufacturers', 'Beauty product producers', 'Beauty distributors', 'Beauty wholesalers', 'Beauty retailers', 'Salons and spas', 'Beauty agencies', 'Beauty product brokers'],
  'Jewelry & Gemstones': ['Gemstone miners', 'Lapidary services', 'Jewelry manufacturers', 'Gemstone and mineral distributors', 'Jewelry wholesalers', 'Diamond brokers', 'Crystal and mineral shops', 'Fine jewelry stores', 'Jewelry repair'],
  'Real Estate': ['Property developers', 'Construction producers', 'Real estate distributors', 'Property wholesalers', 'Real estate retailers', 'Property management services', 'Real estate agencies', 'Real estate brokers'],
  Apparel: ['Textile producers', 'Apparel manufacturers', 'Apparel distributors', 'Apparel wholesalers', 'Clothing retailers', 'Tailoring services', 'Fashion agencies', 'Apparel brokers'],
  'Home & Garden': ['Furniture manufacturers', 'Garden product producers', 'Home goods distributors', 'Home goods wholesalers', 'Home and garden retailers', 'Interior design services', 'Home improvement agencies', 'Home goods brokers'],
  Automotive: ['Vehicle manufacturers', 'Auto parts producers', 'Automotive distributors', 'Auto parts wholesalers', 'Vehicle retailers', 'Automotive repair services', 'Automotive agencies', 'Vehicle brokers'],
  Services: ['Service producers', 'Professional service agencies', 'Service distributors', 'Service wholesalers', 'Service retailers', 'Service providers', 'Professional consultants', 'Service brokers'],
  Pets: ['Pet product manufacturers', 'Animal breeders', 'Pet product distributors', 'Pet product wholesalers', 'Pet stores', 'Veterinary services', 'Pet care agencies', 'Pet product brokers'],
};

const icons: Record<string, string> = { Food: 'UtensilsCrossed', Drinks: 'GlassWater', Electronics: 'Laptop', Medical: 'Pill', Shoes: 'Footprints', Beauty: 'Scissors', 'Jewelry & Gemstones': 'Gem', 'Real Estate': 'Building', Apparel: 'Shirt', 'Home & Garden': 'Home', Automotive: 'Car', Services: 'Wrench', Pets: 'Bone' };

export function createDefaultCategoryTaxonomy(): CategoryItem[] {
  return Object.entries(groups).flatMap(([name, children], parentIndex) => {
    const parentId = `cat_${parentIndex + 1}`;
    const parent: CategoryItem = { id: parentId, name, icon: icons[name] || 'MoreHorizontal', order: parentIndex + 1, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), parentId: null, isActive: true };
    return [parent, ...children.map((child, index) => ({ id: `${parentId}_sub_${index + 1}`, name: child, icon: 'MoreHorizontal', order: index + 1, slug: child.toLowerCase().replace(/[^a-z0-9]+/g, '-'), parentId, isActive: true }))];
  });
}

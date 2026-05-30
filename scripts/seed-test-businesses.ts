/**
 * Seed script for adding test businesses to Firestore
 * Run with: npx ts-node scripts/seed-test-businesses.ts
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCPsC3RzJkiTELNQVmc-UPlz47aZI0nVNM",
  authDomain: "distributors-connect-vrglt.firebaseapp.com",
  databaseURL: "https://distributors-connect-vrglt-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "distributors-connect-vrglt",
  storageBucket: "distributors-connect-vrglt.firebasestorage.app",
  messagingSenderId: "419892415781",
  appId: "1:419892415781:web:424747f8a86f4146cb1ecc",
  measurementId: "G-LK8N2S601W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const auth = getAuth(app);

interface TestBusiness {
  uid: string;
  email: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  phone: string;
  category: string;
  role: 'company' | 'wholesaler' | 'distributor' | 'shopkeeper';
  latitude: number;
  longitude: number;
  description: string;
  createdAt: string;
  storefrontWallpaper?: string;
}

const testBusinesses: TestBusiness[] = [
  {
    uid: 'test-business-001',
    email: 'coffee-roasters@business.local',
    businessName: 'artisan-coffee-roasters',
    address: '456 java Lane',
    city: 'Los Angeles',
    state: 'CA',
    country: 'United States',
    countryCode: 'US',
    phone: '+1-555-0101',
    category: 'Food & Beverages',
    role: 'company',
    latitude: 34.0522,
    longitude: -118.2437,
    description: 'Premium artisan coffee roasting and distribution',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    uid: 'test-business-002',
    email: 'organic-farms@business.local',
    businessName: 'fresh-organic-farms',
    address: '789 Harvest Road',
    city: 'San Francisco',
    state: 'CA',
    country: 'United States',
    countryCode: 'US',
    phone: '+1-555-0102',
    category: 'Agriculture',
    role: 'distributor',
    latitude: 37.7749,
    longitude: -122.4194,
    description: 'Organic produce distribution network',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    uid: 'test-business-003',
    email: 'electronics-wholesale@business.local',
    businessName: 'tech-electronics-wholesale',
    address: '321 Circuit Street',
    city: 'San Jose',
    state: 'CA',
    country: 'United States',
    countryCode: 'US',
    phone: '+1-555-0103',
    category: 'Electronics',
    role: 'wholesaler',
    latitude: 37.3382,
    longitude: -121.8863,
    description: 'Wholesale electronics distributor',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    uid: 'test-business-004',
    email: 'fashion-boutique@business.local',
    businessName: 'style-fashion-boutique',
    address: '654 Fashion Avenue',
    city: 'New York',
    state: 'NY',
    country: 'United States',
    countryCode: 'US',
    phone: '+1-555-0104',
    category: 'Fashion',
    role: 'shopkeeper',
    latitude: 40.7128,
    longitude: -74.0060,
    description: 'Trendy fashion boutique with curated selections',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    uid: 'test-business-005',
    email: 'furniture-manufacturer@business.local',
    businessName: 'premium-furniture-co',
    address: '987 Woodcraft Lane',
    city: 'Seattle',
    state: 'WA',
    country: 'United States',
    countryCode: 'US',
    phone: '+1-555-0105',
    category: 'Furniture',
    role: 'company',
    latitude: 47.6062,
    longitude: -122.3321,
    description: 'Custom and wholesale furniture manufacturing',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    uid: 'test-business-006',
    email: 'beauty-supplies@business.local',
    businessName: 'beauty-essentials-supply',
    address: '135 Glamour Street',
    city: 'Miami',
    state: 'FL',
    country: 'United States',
    countryCode: 'US',
    phone: '+1-555-0106',
    category: 'Beauty & Personal Care',
    role: 'distributor',
    latitude: 25.7617,
    longitude: -80.1918,
    description: 'Beauty and personal care supply distributor',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    uid: 'test-business-007',
    email: 'auto-parts@business.local',
    businessName: 'auto-parts-unlimited',
    address: '246 Engine Street',
    city: 'Detroit',
    state: 'MI',
    country: 'United States',
    countryCode: 'US',
    phone: '+1-555-0107',
    category: 'Automotive',
    role: 'wholesaler',
    latitude: 42.3314,
    longitude: -83.0458,
    description: 'Automotive parts wholesale supplier',
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    uid: 'test-business-008',
    email: 'hardware-store@business.local',
    businessName: 'reliable-hardware-store',
    address: '802 Hammer Drive',
    city: 'Denver',
    state: 'CO',
    country: 'United States',
    countryCode: 'US',
    phone: '+1-555-0108',
    category: 'Hardware & Tools',
    role: 'shopkeeper',
    latitude: 39.7392,
    longitude: -104.9903,
    description: 'Complete hardware and tool retail store',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...\n');

    // Check for existing test businesses
    const usersRef = collection(firestore, 'users');
    const existingQuery = query(usersRef, where('uid', 'in', testBusinesses.map(b => b.uid)));
    const existingDocs = await getDocs(existingQuery);

    if (existingDocs.size > 0) {
      console.log(`⚠️  Found ${existingDocs.size} existing test businesses. Updating them...\n`);
    }

    let addedCount = 0;
    let updatedCount = 0;

    for (const business of testBusinesses) {
      try {
        const docRef = doc(firestore, 'users', business.uid);
        await setDoc(docRef, business, { merge: true });
        
        const isUpdate = existingDocs.docs.some(doc => doc.id === business.uid);
        if (isUpdate) {
          updatedCount++;
          console.log(`✏️  Updated: ${business.businessName} (${business.city})`);
        } else {
          addedCount++;
          console.log(`✅ Added: ${business.businessName} (${business.city})`);
        }
      } catch (error) {
        console.error(`❌ Error adding business ${business.businessName}:`, error);
      }
    }

    console.log(`\n📊 Seed Summary:`);
    console.log(`   Added: ${addedCount}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Total: ${testBusinesses.length}\n`);

    // Verify the data
    console.log('🔍 Verifying seeded businesses...\n');
    const allBusinessesQuery = query(usersRef, where('role', 'in', ['company', 'wholesaler', 'distributor', 'shopkeeper']));
    const allDocs = await getDocs(allBusinessesQuery);
    console.log(`Total businesses in database: ${allDocs.size}`);

    if (allDocs.size > 0) {
      console.log('\n📋 Businesses by role:');
      const roleCount: { [key: string]: number } = {};
      allDocs.forEach(doc => {
        const role = doc.data().role;
        roleCount[role] = (roleCount[role] || 0) + 1;
      });
      Object.entries(roleCount).forEach(([role, count]) => {
        console.log(`   ${role}: ${count}`);
      });
    }

    console.log('\n✨ Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed
seedDatabase().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

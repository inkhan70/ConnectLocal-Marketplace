# ConnectLocal Marketplace - Manual Test Data

This document provides instructions for manually seeding the Firestore database with test data for the ConnectLocal Marketplace application.

## 📊 Database Structure

### Collections

1. **`users`** - Business profiles and user accounts
2. **`categories`** - Business categories
3. **`products`** - Product inventory (associated with businesses)

## 🔧 How to Add Test Data

### Option 1: Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `distributors-connect-vrglt`
3. Navigate to **Firestore Database**
4. Click **+ Add collection** or **+ Add document**
5. Copy-paste the data from sections below

### Option 2: Firebase CLI

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy rules if needed
firebase deploy --only firestore:rules
```

### Option 3: Cloud Functions (Recommended for Production)

Create a scheduled Cloud Function to seed data on demand.

---

## 📝 Test Data to Add

### 1. Categories Collection

Create a collection called **`categories`** with these documents:

```json
{
  "docId": "technology",
  "name": "Technology & Electronics",
  "description": "IT equipment, electronics, gadgets and tech supplies",
  "icon": "💻",
  "order": 1
}
```

```json
{
  "docId": "food-beverages",
  "name": "Food & Beverages",
  "description": "Food products, beverages, and related supplies",
  "icon": "🍽️",
  "order": 2
}
```

```json
{
  "docId": "fashion",
  "name": "Fashion & Apparel",
  "description": "Clothing, shoes, accessories and fashion items",
  "icon": "👗",
  "order": 3
}
```

```json
{
  "docId": "home-garden",
  "name": "Home & Garden",
  "description": "Furniture, home decor, and gardening supplies",
  "icon": "🏠",
  "order": 4
}
```

```json
{
  "docId": "health-wellness",
  "name": "Health & Wellness",
  "description": "Health products, supplements, and wellness supplies",
  "icon": "💊",
  "order": 5
}
```

```json
{
  "docId": "automotive",
  "name": "Automotive",
  "description": "Car parts, accessories, and automotive supplies",
  "icon": "🚗",
  "order": 6
}
```

### 2. Users Collection (Businesses)

Create these documents in the **`users`** collection:

#### Document 1: Artisan Coffee Roasters (Company)

```json
{
  "uid": "test-business-001",
  "email": "coffee@test.local",
  "businessName": "Artisan Coffee Roasters",
  "address": "456 Java Lane",
  "city": "Los Angeles",
  "state": "CA",
  "country": "United States",
  "countryCode": "US",
  "phone": "+1-555-0101",
  "category": "Food & Beverages",
  "role": "company",
  "latitude": 34.0522,
  "longitude": -118.2437,
  "description": "Premium artisan coffee roasting and distribution",
  "createdAt": "2026-05-28T00:00:00Z",
  "storefrontWallpaper": "https://images.unsplash.com/photo-1559056199-641a0ac8b3f3?w=400"
}
```

#### Document 2: Fresh Organic Farms (Distributor)

```json
{
  "uid": "test-business-002",
  "email": "organic@test.local",
  "businessName": "Fresh Organic Farms",
  "address": "789 Harvest Road",
  "city": "San Francisco",
  "state": "CA",
  "country": "United States",
  "countryCode": "US",
  "phone": "+1-555-0102",
  "category": "Food & Beverages",
  "role": "distributor",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "description": "Organic produce distribution network",
  "createdAt": "2026-05-29T00:00:00Z",
  "storefrontWallpaper": "https://images.unsplash.com/photo-1488751045120-3074e616c87d?w=400"
}
```

#### Document 3: Tech Electronics Wholesale (Wholesaler)

```json
{
  "uid": "test-business-003",
  "email": "tech@test.local",
  "businessName": "Tech Electronics Wholesale",
  "address": "321 Circuit Street",
  "city": "San Jose",
  "state": "CA",
  "country": "United States",
  "countryCode": "US",
  "phone": "+1-555-0103",
  "category": "Technology & Electronics",
  "role": "wholesaler",
  "latitude": 37.3382,
  "longitude": -121.8863,
  "description": "Wholesale electronics and computer parts distributor",
  "createdAt": "2026-05-27T00:00:00Z",
  "storefrontWallpaper": "https://images.unsplash.com/photo-1517433456452-f06a18a7fc13?w=400"
}
```

#### Document 4: Style Fashion Boutique (Shopkeeper)

```json
{
  "uid": "test-business-004",
  "email": "fashion@test.local",
  "businessName": "Style Fashion Boutique",
  "address": "654 Fashion Avenue",
  "city": "New York",
  "state": "NY",
  "country": "United States",
  "countryCode": "US",
  "phone": "+1-555-0104",
  "category": "Fashion & Apparel",
  "role": "shopkeeper",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "description": "Trendy fashion boutique with curated selections",
  "createdAt": "2026-05-25T00:00:00Z",
  "storefrontWallpaper": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400"
}
```

#### Document 5: Premium Furniture Co (Company)

```json
{
  "uid": "test-business-005",
  "email": "furniture@test.local",
  "businessName": "Premium Furniture Co",
  "address": "987 Woodcraft Lane",
  "city": "Seattle",
  "state": "WA",
  "country": "United States",
  "countryCode": "US",
  "phone": "+1-555-0105",
  "category": "Home & Garden",
  "role": "company",
  "latitude": 47.6062,
  "longitude": -122.3321,
  "description": "Custom and wholesale furniture manufacturing",
  "createdAt": "2026-05-30T00:00:00Z",
  "storefrontWallpaper": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400"
}
```

#### Document 6: Beauty Essentials Supply (Distributor)

```json
{
  "uid": "test-business-006",
  "email": "beauty@test.local",
  "businessName": "Beauty Essentials Supply",
  "address": "135 Glamour Street",
  "city": "Miami",
  "state": "FL",
  "country": "United States",
  "countryCode": "US",
  "phone": "+1-555-0106",
  "category": "Health & Wellness",
  "role": "distributor",
  "latitude": 25.7617,
  "longitude": -80.1918,
  "description": "Beauty and personal care supply distributor",
  "createdAt": "2026-05-26T00:00:00Z",
  "storefrontWallpaper": "https://images.unsplash.com/photo-1596462502278-af96f86f3013?w=400"
}
```

#### Document 7: Auto Parts Unlimited (Wholesaler)

```json
{
  "uid": "test-business-007",
  "email": "autoparts@test.local",
  "businessName": "Auto Parts Unlimited",
  "address": "246 Engine Street",
  "city": "Detroit",
  "state": "MI",
  "country": "United States",
  "countryCode": "US",
  "phone": "+1-555-0107",
  "category": "Automotive",
  "role": "wholesaler",
  "latitude": 42.3314,
  "longitude": -83.0458,
  "description": "Automotive parts wholesale supplier",
  "createdAt": "2026-05-24T00:00:00Z",
  "storefrontWallpaper": "https://images.unsplash.com/photo-1486262715619-67b519e0bbe5?w=400"
}
```

#### Document 8: Reliable Hardware Store (Shopkeeper)

```json
{
  "uid": "test-business-008",
  "email": "hardware@test.local",
  "businessName": "Reliable Hardware Store",
  "address": "802 Hammer Drive",
  "city": "Denver",
  "state": "CO",
  "country": "United States",
  "countryCode": "US",
  "phone": "+1-555-0108",
  "category": "Home & Garden",
  "role": "shopkeeper",
  "latitude": 39.7392,
  "longitude": -104.9903,
  "description": "Complete hardware and tool retail store",
  "createdAt": "2026-05-23T00:00:00Z",
  "storefrontWallpaper": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400"
}
```

---

## 🔐 Firestore Security Rules

For development, you may need to update your Firestore rules to allow writes. Here's a permissive development rule set:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Allow anyone to read businesses
    match /users/{userId} {
      allow read: if resource.data.role in ['company', 'wholesaler', 'distributor', 'shopkeeper'];
    }
    
    // Allow anyone to read categories
    match /categories/{categoryId} {
      allow read: if true;
    }
    
    // Admin users can manage everything
    match /{document=**} {
      allow read, write: if request.auth.token.admin == true;
    }
  }
}
```

---

## ✅ Verification Steps

After adding test data:

1. **Check Categories Page**
   - Navigate to `/categories`
   - Should see 6 business categories displayed

2. **Check Businesses by Role**
   - Navigate to `/businesses?role=producers`
   - Should see "Artisan Coffee Roasters" and "Premium Furniture Co"
   
   - Navigate to `/businesses?role=wholesalers`
   - Should see "Tech Electronics Wholesale" and "Auto Parts Unlimited"
   
   - Navigate to `/businesses?role=distributors`
   - Should see "Fresh Organic Farms" and "Beauty Essentials Supply"
   
   - Navigate to `/businesses?role=shopkeepers`
   - Should see "Style Fashion Boutique" and "Reliable Hardware Store"

3. **Check Homepage**
   - "Welcome Our Newest Members!" carousel should show recent businesses
   - Should display at least 5 new businesses (created in last 10 days)

4. **Check Individual Business Page**
   - Click on any business card
   - Should navigate to `/products/distributor/{uid}`
   - Business details should display

---

## 📋 Firestore Collection Structure Diagram

```
Firebase Project: distributors-connect-vrglt
│
├── users/
│   ├── test-business-001/ (Artisan Coffee Roasters)
│   ├── test-business-002/ (Fresh Organic Farms)
│   ├── test-business-003/ (Tech Electronics)
│   ├── test-business-004/ (Style Fashion Boutique)
│   ├── test-business-005/ (Premium Furniture)
│   ├── test-business-006/ (Beauty Essentials)
│   ├── test-business-007/ (Auto Parts Unlimited)
│   └── test-business-008/ (Reliable Hardware Store)
│
└── categories/
    ├── technology/ (Technology & Electronics)
    ├── food-beverages/ (Food & Beverages)
    ├── fashion/ (Fashion & Apparel)
    ├── home-garden/ (Home & Garden)
    ├── health-wellness/ (Health & Wellness)
    └── automotive/ (Automotive)
```

---

## 🚀 Next Steps

1. Add the categories to Firestore first (they're used by businesses)
2. Add the 8 business documents
3. Refresh the app and verify data appears on each page
4. Test filtering and searching functionality
5. Proceed with full manual testing as outlined in TEST_REPORT.md

---

**Last Updated:** May 30, 2026  
**Status:** Ready for manual data entry

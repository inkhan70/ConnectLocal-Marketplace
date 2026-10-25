
import type { UserProfile } from "@/contexts/AuthContext";
import { getDashboardType } from "@/lib/subcategories";

type SignUpData = {
    role: "company" | "wholesaler" | "distributor" | "shopkeeper" | "services" | "buyer";
    businessName?: string;
    category?: string;
    subcategoryId?: string;
    subcategoryName?: string;
    fullName?: string;
    address: string;
    city: string;
    state: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
}

/**
 * Creates a complete, default UserProfile object.
 * This ensures all fields are present, preventing inconsistencies.
 * @param uid - The user's unique ID from Firebase Auth.
 * @param email - The user's email.
 * @param data - The data from the sign-up form.
 * @param _isAdmin - Ignored. Admin status can only be granted server-side.
 * @returns A complete UserProfile object.
 */
export function createDefaultUserProfile(
    uid: string, 
    email: string, 
    data: Partial<SignUpData>,
    _isAdmin: boolean = false
): UserProfile {
    const isBusiness = data.role && data.role !== 'buyer';
    
    const profile: UserProfile = {
        uid,
        email,
        role: data.role || 'buyer',
        businessName: data.businessName || "",
        fullName: data.fullName || "",
        category: data.category || "",
        subcategoryId: data.subcategoryId || "",
        subcategoryName: data.subcategoryName || "",
        dashboardType: data.subcategoryId ? getDashboardType(data.subcategoryId) : 'generic',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        countryCode: data.countryCode || '',
        latitude: data.latitude,
        longitude: data.longitude,
        createdAt: new Date().toISOString(),
        // Admin status is decided only by the server (/api/profile/bootstrap). The parameter is kept for
        // call-site compatibility but is deliberately ignored.
        isAdmin: false,
        purchaseHistory: [],
        ghostCoins: 0,
        currencyCode: data.countryCode === 'PK' ? 'PKR' : 'USD',
        ghostCoinRewardPerSale: 0,
        ghostCoinMinimumQuantity: 1,
        ghostCoinOfferEnabled: false,
        balance: 0,
        totalItemsPurchased: 0,
        membershipTier: 'community',
        subscriptionPlanId: 'community',
        subscriptionStatus: 'active',
        subscriptionSource: 'system',
        subscriptionStartDate: new Date().toISOString(),
        storageLimitBytes: 80 * 1024 * 1024,
        maxImages: 15,
        maxListings: 10,
        subscriptionFeatures: [
            'Basic business profile',
            'Up to 15 active images',
            '80 MB storage',
            'Basic customer contact',
            'Standard marketplace visibility',
        ],
        slogan: '',
        businessDescription: '',
        storefrontWallpaper: '',
        pickupEnabled: true,
        deliveryEnabled: true,
        deliveryBaseFee: 0,
        deliveryPerKm: 0,
        deliveryFreeAbove: 0,
        maxDeliveryFee: 0,
        permissions: [],
    };

    return profile;
}


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
}

/**
 * Creates a complete, default UserProfile object.
 * This ensures all fields are present, preventing inconsistencies.
 * @param uid - The user's unique ID from Firebase Auth.
 * @param email - The user's email.
 * @param data - The data from the sign-up form.
 * @param isAdmin - Whether the user should be an admin.
 * @returns A complete UserProfile object.
 */
export function createDefaultUserProfile(
    uid: string, 
    email: string, 
    data: Partial<SignUpData>,
    isAdmin: boolean = false
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
        createdAt: new Date().toISOString(),
        isAdmin: isAdmin,
        purchaseHistory: [],
        ghostCoins: 0,
        balance: 0,
        totalItemsPurchased: 0,
        membershipTier: isBusiness ? 'pro' : 'community',
        slogan: '',
        businessDescription: '',
        storefrontWallpaper: '',
    };

    return profile;
}

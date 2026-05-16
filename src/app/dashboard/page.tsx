"use client";

import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { BuyerDashboard } from './buyer-dashboard';
import { BusinessDashboard } from './business-dashboard';
import { HealthDashboard } from './health-dashboard';
import { AutomotiveDashboard } from './automotive-dashboard';

export default function DashboardPage() {
    const { userProfile, loading } = useAuth();

    if (loading) {
        return (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!userProfile) {
        // This should ideally not happen if the layout redirects, but as a fallback.
        return <div>User profile not found. Please try logging in again.</div>
    }

    // --- Dashboard Routing Logic ---
    // For buyer role, always show buyer dashboard
    if (userProfile.role === 'buyer') {
        return <BuyerDashboard />;
    }

    // For service providers, show services dashboard
    if (userProfile.role === 'services') {
        // Services dashboard can be a variant of BusinessDashboard with service-specific features
        return <BusinessDashboard />;
    }

    // For all business roles (company, wholesaler, distributor, shopkeeper)
    // Route based on dashboardType if available, otherwise fall back to category
    const dashboardType = userProfile.dashboardType || userProfile.category?.toLowerCase();

    switch (dashboardType) {
        case 'health':
            return <HealthDashboard />;
        case 'automotive':
            return <AutomotiveDashboard />;
        case 'hospitality':
        case 'food':
        case 'services':
        case 'apparel':
        case 'jewelry':
        case 'beauty':
        case 'electronics':
        case 'realestate':
        case 'pets':
            // All other types use the generic business dashboard
            // In the future, these can have specialized dashboards
            return <BusinessDashboard />;
        default:
            // Fallback for any unknown dashboard type
            return <BusinessDashboard />;
    }
}

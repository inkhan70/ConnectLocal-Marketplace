"use client";

import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { BuyerDashboard } from './buyer-dashboard';
import { BusinessDashboard } from './business-dashboard';
import { HealthDashboard } from './health-dashboard';
import { AutomotiveDashboard } from './automotive-dashboard';
import { RoleDashboard } from './role-dashboard';

export default function DashboardPage() {
    const { userProfile, loading } = useAuth();

    if (loading) {
        return (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!userProfile) {
        return (
            <div className="flex justify-center items-center h-64 text-muted-foreground">
                User profile not found. Please try logging in again.
            </div>
        );
    }

    // --- Dashboard Routing Logic ---

    // 1. Buyers always see the buyer-centric dashboard
    if (userProfile.role === 'buyer') {
        return <BuyerDashboard />;
    }

    // 2. Pure service providers route directly to the Role-based view
    if (userProfile.role === 'services') {
        return <RoleDashboard />;
    }

    // 3. All Business roles (company, wholesaler, distributor, shopkeeper, producer, hotel)
    // Route dynamically based on dashboardType or fallback to business category
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
            return <BusinessDashboard />;
        default:
            // Fallback default for any undefined business categories
            return <BusinessDashboard />;
    }
}

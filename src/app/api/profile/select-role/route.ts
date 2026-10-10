import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import { findSubcategory, getDashboardType } from '@/lib/subcategories';
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/lib/subscription-domain';

const ROLE_CONFIG: Record<string, { storedRole: string; dashboardType: string; subcategoryId?: string; subcategoryName?: string }> = {
  buyer: { storedRole: 'buyer', dashboardType: 'buyer' },
  company: { storedRole: 'company', dashboardType: 'business' },
  wholesaler: { storedRole: 'wholesaler', dashboardType: 'business' },
  distributor: { storedRole: 'distributor', dashboardType: 'business' },
  shopkeeper: { storedRole: 'shopkeeper', dashboardType: 'shopkeeper' },
  services: { storedRole: 'services', dashboardType: 'services' },
  doctor: { storedRole: 'services', dashboardType: getDashboardType('health_doctor'), subcategoryId: 'health_doctor', subcategoryName: 'Doctor / Medical Professional' },
};

export async function POST(request: Request) {
  try {
    const decoded = await verifyBearerToken(request);
    const body = await request.json().catch(() => ({}));
    const requestedRole = typeof body.role === 'string' ? body.role : '';
    const config = ROLE_CONFIG[requestedRole];
    if (!config) return NextResponse.json({ error: 'Invalid role selection.' }, { status: 400 });

    // Step 2 of onboarding: every business role (except the Doctor shortcut) must also choose a business type.
    const needsBusinessType = config.storedRole !== 'buyer' && !config.subcategoryId;
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim().slice(0, 120) : '';
    let chosen: ReturnType<typeof findSubcategory> = null;
    if (needsBusinessType) {
      const subcategoryId = typeof body.subcategoryId === 'string' ? body.subcategoryId : '';
      chosen = findSubcategory(subcategoryId);
      if (!chosen) return NextResponse.json({ error: 'Please choose your business type.' }, { status: 400 });
      if (!businessName) return NextResponse.json({ error: 'Please enter your business name.' }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('users').doc(decoded.uid);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });

    const current = snap.data() || {};
    if (current.isAdmin === true) {
      return NextResponse.json({ error: 'Admin accounts use the admin workspace.' }, { status: 403 });
    }
    if (current.roleSelectionCompleted === true && current.needsRoleSelection !== true) {
      return NextResponse.json({ error: 'Role selection has already been completed.' }, { status: 409 });
    }

    const community = DEFAULT_SUBSCRIPTION_PLANS.find((plan) => plan.id === 'community')!;
    const update: Record<string, unknown> = {
      role: config.storedRole,
      // The business type decides which dashboard layout (health, automotive, food, ...) the member sees.
      dashboardType: chosen ? chosen.option.dashboardType : config.dashboardType,
      needsRoleSelection: false,
      roleSelectionCompleted: true,
      roleSelectedAt: FieldValue.serverTimestamp(),
      // Role selection never upgrades a paid plan. Legacy profiles without a real plan are normalized to Community.
      ...(current.subscriptionPlanId ? { membershipTier: current.membershipTier || 'community' } : {
        membershipTier: 'community',
        subscriptionPlanId: community.id,
        subscriptionStatus: 'active',
        subscriptionSource: 'system',
        subscriptionStartDate: new Date().toISOString(),
        storageLimitBytes: community.storageLimitBytes,
        maxImages: community.maxImages,
        maxListings: community.maxListings,
        subscriptionFeatures: community.features,
      }),
    };

    if (businessName) update.businessName = businessName;

    if (chosen) {
      update.category = chosen.categoryKey;
      update.subcategoryId = chosen.option.id;
      update.subcategoryName = chosen.option.name;
    } else if (config.subcategoryId) {
      update.category = 'medical';
      update.subcategoryId = config.subcategoryId;
      update.subcategoryName = config.subcategoryName;
    } else {
      update.subcategoryId = FieldValue.delete();
      update.subcategoryName = FieldValue.delete();
    }

    await ref.update(update);
    return NextResponse.json({ ok: true, role: config.storedRole, dashboardType: update.dashboardType });
  } catch (error: any) {
    console.error('Role selection failed:', error);
    const status = error?.message === 'Authentication required.' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'Unable to save role selection.' }, { status });
  }
}

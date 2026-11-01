import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { describeServerError, getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import { findSubcategory, getDashboardType } from '@/lib/subcategories';
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/lib/subscription-domain';
import { readRealtimeCategories } from '@/lib/server/category-rtdb';
import { resolveChosenType, roleForSelection } from '@/lib/category-live';

export const runtime = 'nodejs';

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
    let config = ROLE_CONFIG[requestedRole];
    if (!config) return NextResponse.json({ error: 'Invalid role selection.' }, { status: 400 });

    const subcategoryId = typeof body.subcategoryId === 'string' ? body.subcategoryId : '';
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim().slice(0, 120) : '';
    const requestedCategory = typeof body.category === 'string' ? body.category.trim().slice(0, 100) : '';

    // Resolve the chosen business type against the LIVE admin list (the same list guests browse).
    // Done for every role: a buyer / collector also keeps the type they picked.
    let liveList: Awaited<ReturnType<typeof readRealtimeCategories>> = [];
    if (subcategoryId) {
      try { liveList = await readRealtimeCategories(); } catch (error) { console.error('Live category lookup failed; falling back to the built-in catalogue:', error); }
    }
    let resolved = subcategoryId ? resolveChosenType(liveList, subcategoryId, config.storedRole) : null;
    // The server decides buyer-type choices itself: picking Buyer / Customer / Collector always makes a buyer,
    // whatever role the browser sent, so these members get the buyer dashboard (never shopkeeper / services).
    if (resolved && !config.subcategoryId && config.storedRole !== 'buyer' && roleForSelection(resolved.categoryName, resolved.option.name) === 'buyer') {
      config = ROLE_CONFIG.buyer;
      resolved = resolveChosenType(liveList, subcategoryId, 'buyer');
    }

    // Business roles (except the Doctor shortcut) must choose a business type; buyers may.
    const needsBusinessType = config.storedRole !== 'buyer' && !config.subcategoryId;
    let chosen: ReturnType<typeof findSubcategory> = null;
    let chosenCategoryId: string | undefined;
    if (needsBusinessType || (config.storedRole === 'buyer' && subcategoryId)) {
      if (resolved) {
        chosenCategoryId = resolved.categoryId;
        chosen = { categoryKey: resolved.categoryKey, option: resolved.option } as any;
      } else {
        chosen = findSubcategory(subcategoryId);
      }
      if (!chosen && needsBusinessType) return NextResponse.json({ error: 'Please choose a business type.' }, { status: 400 });
      if (needsBusinessType && !businessName) return NextResponse.json({ error: 'Please enter your business name.' }, { status: 400 });
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
      dashboardType: config.storedRole === 'buyer' ? 'buyer' : chosen ? chosen.option.dashboardType : config.dashboardType,
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
      if (chosenCategoryId) update.categoryId = chosenCategoryId;
      update.subcategoryId = chosen.option.id;
      update.subcategoryName = chosen.option.name;
    } else if (config.subcategoryId) {
      update.category = 'medical';
      update.subcategoryId = config.subcategoryId;
      update.subcategoryName = config.subcategoryName;
    } else {
      if (config.storedRole === 'buyer' && requestedCategory) update.category = requestedCategory;
      update.subcategoryId = FieldValue.delete();
      update.subcategoryName = FieldValue.delete();
    }

    await ref.update(update);
    return NextResponse.json({ ok: true, role: config.storedRole, dashboardType: update.dashboardType });
  } catch (error: any) {
    console.error('Role selection failed:', error);
    const described = describeServerError(error);
    // Plain Errors thrown above carry user-facing messages; infrastructure failures use the descriptive text.
    const message = described.code === 'server_error' ? (error?.message || 'Unable to save role selection.') : described.message;
    return NextResponse.json({ error: message, code: described.code }, { status: described.status });
  }
}

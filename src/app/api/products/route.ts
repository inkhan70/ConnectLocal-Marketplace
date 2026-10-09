import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { FieldValue } from 'firebase-admin/firestore';
import { authErrorStatus, getAdminDb, getAdminStorage, verifyBearerToken } from '@/lib/server/firebase-admin';
import { getSubscriptionPlan } from '@/lib/server/subscription-admin';
import { getSubscriptionStatus, planToEntitlements, SubscriptionEntitlements } from '@/lib/subscription-domain';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2560;

type ProductInput = {
  id?: string;
  name: string;
  description?: string;
  category: string;
  status: string;
  inventory: number;
  lowStockThreshold?: number;
  varieties: Array<{ id: string; name: string; price: number; image?: string; dataAiHint?: string; imageFile?: string }>;
};

const PRODUCT_STATUSES = ['Active', 'Archived', 'Low Stock', 'Out of Stock'];
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

/** Returns an error message when the client-supplied product payload is unsafe or nonsensical. */
function validateProductInput(product: ProductInput): string | null {
  if (typeof product.name !== 'string' || !product.name.trim() || product.name.length > 200) return 'Product name is required (max 200 characters).';
  if (product.description != null && String(product.description).length > 5000) return 'Description is too long (max 5000 characters).';
  if (!PRODUCT_STATUSES.includes(product.status)) return 'Invalid product status.';
  const inventory = Number(product.inventory);
  if (!Number.isFinite(inventory) || inventory < 0) return 'Inventory must be zero or more.';
  const threshold = Number(product.lowStockThreshold ?? 0);
  if (!Number.isFinite(threshold) || threshold < 0) return 'Low-stock threshold must be zero or more.';
  if (product.varieties.length > 50) return 'A product can have at most 50 varieties.';
  const seen = new Set<string>();
  for (const variety of product.varieties) {
    // Variety ids become part of storage object paths, so they must be path-safe.
    if (typeof variety?.id !== 'string' || !SAFE_ID.test(variety.id)) return 'Each variety needs a valid id.';
    if (seen.has(variety.id)) return 'Variety ids must be unique.';
    seen.add(variety.id);
    const price = Number(variety.price);
    if (!Number.isFinite(price) || price < 0) return `Price for "${variety.name || variety.id}" must be zero or more.`;
  }
  return null;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function parseDataUrl(value: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(value);
  if (!match) throw new Error('Invalid image data.');
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') };
}

async function processImage(dataUrl: string) {
  const { buffer } = parseDataUrl(dataUrl);
  if (!buffer.length) throw new Error('Empty image.');
  let width = MAX_IMAGE_DIMENSION;
  let quality = 82;
  let output = await sharp(buffer).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
  for (const nextQuality of [74, 66, 58, 50, 42]) {
    if (output.length <= MAX_IMAGE_BYTES) break;
    quality = nextQuality;
    output = await sharp(buffer).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
  }
  for (const nextWidth of [2200, 1900, 1600, 1400, 1200]) {
    if (output.length <= MAX_IMAGE_BYTES) break;
    width = nextWidth;
    output = await sharp(buffer).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).webp({ quality: 48 }).toBuffer();
  }
  if (output.length > MAX_IMAGE_BYTES) throw new Error('Image could not be compressed below the 3 MB limit.');
  const metadata = await sharp(output).metadata();
  return { buffer: output, width: metadata.width || 0, height: metadata.height || 0, mime: 'image/webp' as const };
}

async function getEntitlements(uid: string): Promise<SubscriptionEntitlements> {
  const db = getAdminDb();
  const snap = await db.collection('users').doc(uid).get();
  const user = snap.data() || {};
  const plan = user.subscriptionPlanId ? await getSubscriptionPlan(String(user.subscriptionPlanId)) : null;
  const effectiveStatus = getSubscriptionStatus(user.subscriptionStartDate, user.subscriptionEndDate);
  // Dates alone are not enough: a past_due / cancelled / inactive subscription must not keep paid-plan quotas.
  const storedStatus = user.subscriptionStatus ? String(user.subscriptionStatus) : 'active';
  if (effectiveStatus === 'active' && storedStatus === 'active' && plan) return planToEntitlements(plan);
  const community = await getSubscriptionPlan('community');
  if (!community) throw new Error('Community plan is not configured.');
  return planToEntitlements(community);
}

async function saveImage(uid: string, productId: string, varietyId: string, dataUrl: string) {
  const processed = await processImage(dataUrl);
  const path = `products/${uid}/${productId}/${varietyId}.webp`;
  const bucket = getAdminStorage().bucket();
  const file = bucket.file(path);
  await file.save(processed.buffer, {
    resumable: false,
    metadata: {
      contentType: processed.mime,
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: { ownerId: uid, productId, varietyId, processedSizeBytes: String(processed.buffer.length) },
    },
  });
  const [url] = await file.getSignedUrl({ action: 'read', expires: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) });
  return { url, path, sizeBytes: processed.buffer.length, width: processed.width, height: processed.height };
}

async function deleteStorageUrl(url: string) {
  if (!url) return;
  try {
    const match = decodeURIComponent(url).match(/\/o\/([^?]+)/);
    if (!match) return;
    const bucket = getAdminStorage().bucket();
    await bucket.file(match[1]).delete({ ignoreNotFound: true });
  } catch (error) {
    console.warn('Unable to delete old image:', error);
  }
}

async function deleteMediaRecord(storagePath?: string, mediaId?: string) {
  const db = getAdminDb();
  if (mediaId) {
    await db.collection('mediaLibrary').doc(mediaId).delete().catch(() => undefined);
    return;
  }
  if (!storagePath) return;
  const snap = await db.collection('mediaLibrary').where('storagePath', '==', storagePath).limit(10).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

export async function POST(request: NextRequest) {
  return saveProduct(request, false);
}

export async function PUT(request: NextRequest) {
  return saveProduct(request, true);
}

async function saveProduct(request: NextRequest, isEdit: boolean) {
  try {
    const decoded = await verifyBearerToken(request);
    const body = await request.json();
    const product = body?.product as ProductInput;
    if (!product?.name || !product?.category || !Array.isArray(product.varieties) || product.varieties.length === 0) return errorResponse('A valid product with at least one variety is required.');

    const validationError = validateProductInput(product);
    if (validationError) return errorResponse(validationError);
    if (product.id != null && !SAFE_ID.test(String(product.id))) return errorResponse('Invalid product id.');

    const db = getAdminDb();
    const userRef = db.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();
    const user = userSnap.data() || {};
    if (!userSnap.exists) return errorResponse('Profile not found.', 404);
    if (!user.role || user.role === 'buyer') return errorResponse('Only business accounts can manage products.', 403);

    const entitlements = await getEntitlements(decoded.uid);
    const productId = isEdit ? String(product.id || '') : String(product.id || cryptoRandomId());
    if (isEdit && !productId) return errorResponse('Product ID is required for edits.');
    const productRef = db.collection('products').doc(productId);
    const existingSnap = await productRef.get();
    if (isEdit && (!existingSnap.exists || existingSnap.data()?.userId !== decoded.uid)) return errorResponse('Product not found or not owned by you.', 404);
    if (!isEdit && existingSnap.exists) return errorResponse('Product ID already exists.', 409);

    const existing = existingSnap.exists ? existingSnap.data() || {} : null;
    const currentListingsSnap = await db.collection('products').where('userId', '==', decoded.uid).get();
    if (!isEdit && entitlements.maxListings != null && currentListingsSnap.size >= entitlements.maxListings) return errorResponse(`Your plan allows ${entitlements.maxListings} product listings. Upgrade your plan to add more.`, 409);

    const currentProducts = currentListingsSnap.docs.map((item) => item.data() || {});
    const existingImagesAcrossAccount = currentProducts.reduce((total, item) => total + (Array.isArray(item.varieties) ? item.varieties.filter((v: any) => !!v?.image).length : 0), 0);
    const existingStorageAcrossAccount = currentProducts.reduce((total, item) => total + (Array.isArray(item.varieties) ? item.varieties.reduce((sum: number, v: any) => sum + Number(v?.imageSizeBytes || 0), 0) : 0), 0);
    const oldProductImageCount = isEdit && existing ? (Array.isArray(existing.varieties) ? existing.varieties.filter((v: any) => !!v?.image).length : 0) : 0;
    const oldProductStorage = isEdit && existing ? (Array.isArray(existing.varieties) ? existing.varieties.reduce((sum: number, v: any) => sum + Number(v?.imageSizeBytes || 0), 0) : 0) : 0;
    const projectedImageCount = existingImagesAcrossAccount - oldProductImageCount;
    const projectedStorageBefore = existingStorageAcrossAccount - oldProductStorage;
    let addedStorage = 0;
    const processedVarieties = [];
    for (const variety of product.varieties) {
      let image = variety.image || '';
      let imageMeta: any = {};
      if (variety.imageFile === 'DELETE') {
        const oldVariety = (existing?.varieties || []).find((v: any) => v.id === variety.id);
        await deleteStorageUrl(image);
        await deleteMediaRecord(oldVariety?.imageStoragePath, oldVariety?.mediaId);
        image = '';
      } else if (variety.imageFile?.startsWith('data:image/')) {
        const oldImage = image;
        const saved = await saveImage(decoded.uid, productId, variety.id, variety.imageFile);
        image = saved.url;
        const oldVariety = (existing?.varieties || []).find((v: any) => v.id === variety.id);
        if (oldImage && oldImage !== image) {
          await deleteStorageUrl(oldImage);
          await deleteMediaRecord(oldVariety?.imageStoragePath, oldVariety?.mediaId);
        }
        const mediaRef = db.collection('mediaLibrary').doc();
        await mediaRef.set({
          id: mediaRef.id,
          ownerId: decoded.uid,
          storagePath: saved.path,
          downloadUrl: saved.url,
          categoryId: String(product.category).toLowerCase().replace(/\s+/g, '_'),
          categoryName: product.category,
          memberType: user.role,
          libraryKey: `${String(user.role)}:${String(product.category).toLowerCase()}`,
          productType: product.category,
          productName: product.name,
          originalFileName: `${variety.name || product.name}.image`,
          processedFileName: `${variety.id}.webp`,
          width: saved.width,
          height: saved.height,
          sizeBytes: saved.sizeBytes,
          mimeType: 'image/webp',
          visibility: 'public',
          createdAt: FieldValue.serverTimestamp(),
        });
        imageMeta = { imageSizeBytes: saved.sizeBytes, imageWidth: saved.width, imageHeight: saved.height, imageStoragePath: saved.path, mediaId: mediaRef.id };
        addedStorage += saved.sizeBytes;
        if (entitlements.storageLimitBytes < (projectedStorageBefore + addedStorage)) return errorResponse(`Your plan has ${Math.round(entitlements.storageLimitBytes / 1024 / 1024)} MB of storage. Upgrade your plan or remove unused images.`, 409);
      }
      processedVarieties.push({ id: variety.id, name: variety.name, price: Number(variety.price) || 0, image, dataAiHint: variety.dataAiHint || '', ...(image ? (imageMeta.imageSizeBytes ? imageMeta : { imageSizeBytes: Number((existing?.varieties || []).find((v: any) => v.id === variety.id)?.imageSizeBytes || 0) }) : {} ) });
    }

    const finalImageCount = projectedImageCount + processedVarieties.filter((v) => !!v.image).length;
    if (entitlements.maxImages != null && finalImageCount > entitlements.maxImages) return errorResponse(`Your plan allows ${entitlements.maxImages} active images. Upgrade your plan to add more.`, 409);
    const finalStorage = projectedStorageBefore + processedVarieties.reduce((sum, v) => sum + Number(v.imageSizeBytes || 0), 0);
    if (finalStorage > entitlements.storageLimitBytes) return errorResponse(`Your plan has ${Math.round(entitlements.storageLimitBytes / 1024 / 1024)} MB of storage. Upgrade your plan or remove unused images.`, 409);

    const dataForFirestore = {
      id: productId,
      userId: decoded.uid,
      name: product.name.trim(),
      description: product.description || '',
      category: product.category,
      status: product.status,
      inventory: Number(product.inventory) || 0,
      lowStockThreshold: Number(product.lowStockThreshold) || 0,
      varieties: processedVarieties,
      updatedAt: FieldValue.serverTimestamp(),
      ...(isEdit ? {} : { createdAt: FieldValue.serverTimestamp() }),
    };
    await productRef.set(dataForFirestore, { merge: isEdit });

    const usedStorage = finalStorage;
    const currentListings = currentListingsSnap.size + (isEdit ? 0 : 1);
    await userRef.update({ usedStorageBytes: usedStorage, currentListings, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ success: true, productId, usedStorageBytes: usedStorage, currentListings, varieties: processedVarieties });
  } catch (error: any) {
    console.error('Product API error:', error);
    return errorResponse(error?.message || 'Could not save product.', authErrorStatus(error));
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const body = await request.json().catch(() => ({}));
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
    if (!productId) return errorResponse('productId is required.');

    const db = getAdminDb();
    const productRef = db.collection('products').doc(productId);
    const snap = await productRef.get();
    if (!snap.exists) return errorResponse('Product not found.', 404);
    const product = snap.data() || {};
    if (decoded.isAdmin !== true && product.userId !== decoded.uid) return errorResponse('You do not own this product.', 403);

    const varieties = Array.isArray(product.varieties) ? product.varieties : [];
    const bucket = getAdminStorage().bucket();
    const mediaIds = new Set<string>();
    const storagePaths = new Set<string>();
    for (const variety of varieties) {
      if (variety?.mediaId) mediaIds.add(String(variety.mediaId));
      if (variety?.imageStoragePath) storagePaths.add(String(variety.imageStoragePath));
    }

    await Promise.all(Array.from(storagePaths).map((path) => bucket.file(path).delete({ ignoreNotFound: true }).catch(() => undefined)));
    const mediaByProduct = await db.collection('mediaLibrary').where('ownerId', '==', product.userId).where('productName', '==', String(product.name || '')).limit(100).get();
    const batch = db.batch();
    mediaByProduct.docs.forEach((media) => {
      const data = media.data() || {};
      if (mediaIds.has(media.id) || storagePaths.has(String(data.storagePath || ''))) batch.delete(media.ref);
    });
    mediaIds.forEach((id) => batch.delete(db.collection('mediaLibrary').doc(id)));
    batch.delete(productRef);
    await batch.commit();

    if (decoded.isAdmin !== true) {
      const remaining = await db.collection('products').where('userId', '==', decoded.uid).get();
      const usedStorage = remaining.docs.reduce((total, item) => {
        const data = item.data() || {};
        return total + (Array.isArray(data.varieties) ? data.varieties.reduce((sum: number, v: any) => sum + Number(v?.imageSizeBytes || 0), 0) : 0);
      }, 0);
      await db.collection('users').doc(decoded.uid).update({ usedStorageBytes: usedStorage, currentListings: remaining.size, updatedAt: FieldValue.serverTimestamp() });
    }
    return NextResponse.json({ success: true, productId });
  } catch (error: any) {
    console.error('Product delete API error:', error);
    return errorResponse(error?.message || 'Could not delete product.', authErrorStatus(error));
  }
}

function cryptoRandomId() {
  return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

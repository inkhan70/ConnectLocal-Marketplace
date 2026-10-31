import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin, authErrorStatus, safeMessage } from '@/lib/server/firebase-admin';

const codePattern = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const validDirection = (value: unknown): value is 'ltr' | 'rtl' => value === 'ltr' || value === 'rtl';

function validate(body: Record<string, unknown>) {
  const code = String(body.code || '').trim();
  const nativeName = String(body.nativeName || '').trim();
  const fallback = String(body.fallback || 'en').trim().toLowerCase();
  if (!codePattern.test(code) || !nativeName || !codePattern.test(fallback) || !validDirection(body.direction)) throw new Error('Use a valid language code, native name, fallback, and direction.');
  const translations = body.translations && typeof body.translations === 'object' && !Array.isArray(body.translations) ? body.translations : {};
  if (JSON.stringify(translations).length > 2_000_000) throw new Error('Translation dictionary is too large.');
  return { code, nativeName, font: String(body.font || 'PT Sans').slice(0, 100), direction: body.direction, fallback, translations, enabled: body.enabled !== false, published: Boolean(body.published) };
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const code = new URL(request.url).searchParams.get('code');
    if (code && new URL(request.url).searchParams.get('history') === '1') {
      const snapshot = await getAdminDb().collection('languages').doc(code).collection('versions').orderBy('version', 'desc').limit(20).get();
      return NextResponse.json({ versions: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    }
    const snapshot = await getAdminDb().collection('languages').orderBy('updatedAt', 'desc').get();
    return NextResponse.json({ languages: snapshot.docs.map((doc) => ({ code: doc.id, ...doc.data() })) });
  }
  catch (error) { return NextResponse.json({ error: safeMessage(error, 'Unable to load languages.') }, { status: authErrorStatus(error) }); }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const raw = await request.json() as Record<string, unknown>;
    const db = getAdminDb();
    if (raw.rollbackVersion !== undefined) {
      const code = String(raw.code || '');
      const version = String(raw.rollbackVersion);
      const versionSnap = await db.collection('languages').doc(code).collection('versions').doc(version).get();
      if (!versionSnap.exists) throw new Error('Translation version not found.');
      const restored = versionSnap.data() as Record<string, unknown>;
      await db.collection('languages').doc(code).set({ ...restored, version: Number(version), updatedAt: new Date().toISOString(), updatedBy: admin.uid }, { merge: true });
      return NextResponse.json({ success: true, code, version: Number(version), rolledBack: true });
    }
    const body = validate(raw);
    const ref = db.collection('languages').doc(body.code);
    const current = await ref.get();
    const now = new Date().toISOString();
    const version = Number(current.data()?.version || 0) + 1;
    await ref.set({ ...body, version, updatedAt: now, updatedBy: admin.uid, publishedAt: body.published ? now : current.data()?.publishedAt || null }, { merge: true });
    await ref.collection('versions').doc(String(version)).set({ ...body, version, createdAt: now, createdBy: admin.uid });
    return NextResponse.json({ success: true, code: body.code, version });
  } catch (error) { return NextResponse.json({ error: safeMessage(error, 'Unable to save language.') }, { status: authErrorStatus(error) }); }
}

import { NextResponse } from 'next/server';
import { getAdminDb, safeMessage } from '@/lib/server/firebase-admin';

const BUILT_INS = [
  { code: 'en', nativeName: 'English', font: 'PT Sans', direction: 'ltr', fallback: 'en', published: true },
  { code: 'ar', nativeName: 'العربية', font: 'Noto Sans Arabic', direction: 'rtl', fallback: 'en', published: true },
  { code: 'ur', nativeName: 'اردو', font: 'Noto Nastaliq Urdu', direction: 'rtl', fallback: 'en', published: true },
  { code: 'fa', nativeName: 'فارسی', font: 'Vazirmatn', direction: 'rtl', fallback: 'en', published: true },
  { code: 'hi', nativeName: 'हिन्दी', font: 'Noto Sans Devanagari', direction: 'ltr', fallback: 'en', published: true },
];

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code')?.toLowerCase();
  try {
    const snapshot = await getAdminDb().collection('languages').where('published', '==', true).get();
    const records = snapshot.docs.map((doc) => ({ code: doc.id, ...doc.data() }));
    if (!code) return NextResponse.json({ languages: [...BUILT_INS, ...records.filter((item) => !BUILT_INS.some((builtIn) => builtIn.code === item.code))] }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
    const language = records.find((item) => item.code === code);
    if (!language) return NextResponse.json({ error: 'Language not found' }, { status: 404 });
    return NextResponse.json(language, { headers: { 'Cache-Control': `public, s-maxage=300, stale-while-revalidate=86400` } });
  } catch (error) {
    return NextResponse.json(code ? { error: safeMessage(error, 'Language unavailable') } : { languages: BUILT_INS, degraded: true }, { status: code ? 503 : 200 });
  }
}

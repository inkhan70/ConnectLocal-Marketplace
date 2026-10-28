import { NextRequest, NextResponse } from 'next/server';
import { searchImages } from '@/lib/server/image-search';
import { verifyBearerToken, HttpError } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const token = await verifyBearerToken(request);
    const params = request.nextUrl.searchParams;
    const query = params.get('q')?.trim() || '';
    if (query.length < 2) return NextResponse.json({ configured: true, results: [], page: 1, perPage: 24, message: 'Enter at least two characters.' });
    const page = Number(params.get('page') || 1);
    const result = await searchImages(query, Number.isFinite(page) ? page : 1, 24, token.uid);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } });
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : Number(error?.status) || 502;
    return NextResponse.json({ configured: false, results: [], message: error?.message || 'Image search is unavailable.' }, { status });
  }
}

import { NextRequest, NextResponse } from 'next/server';

// Compact, stable business URL. The canonical public profile remains /businesses/:id.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const id = String(params.id || '').trim();
  if (!id || !/^[A-Za-z0-9_-]{6,128}$/.test(id)) {
    return new NextResponse('Invalid business link.', { status: 400 });
  }
  return NextResponse.redirect(new URL(`/businesses/${encodeURIComponent(id)}`, request.url), 307);
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── MAINTENANCE MODE ─────────────────────────────────────────────────────────
// Para desactivar: cambiar a false y hacer push
const MAINTENANCE_MODE = false;
// ─────────────────────────────────────────────────────────────────────────────

export function proxy(request: NextRequest) {
  if (!MAINTENANCE_MODE) return NextResponse.next();

  const { pathname } = request.nextUrl;

  const bypass = [
    '/maintenance',
    '/_next',
    '/favicon',
    '/icons',
    '/manifest',
    '/robots',
    '/sitemap',
    '/api/auth',
  ];

  if (bypass.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/maintenance', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|apple-icon|opengraph).*)'],
};

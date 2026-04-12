import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';

export function middleware(request: NextRequest) {
  if (!MAINTENANCE_MODE) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Dejar pasar: la propia página de maintenance, assets estáticos y APIs internas
  const bypass = [
    '/maintenance',
    '/_next',
    '/favicon',
    '/icons',
    '/manifest',
    '/robots',
    '/sitemap',
    '/api/auth',       // Supabase auth callbacks
  ];

  if (bypass.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/maintenance', request.url));
}

export const config = {
  // Aplica a todas las rutas excepto archivos estáticos
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|apple-icon|opengraph).*)'],
};

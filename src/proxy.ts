import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

    const cspHeader = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' https://vercel.live;
        style-src 'self' 'unsafe-inline';
        img-src 'self' blob: data: https://*.public.blob.vercel-storage.com https://lh1.googleusercontent.com https://lh2.googleusercontent.com https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com https://lh7.googleusercontent.com https://drive.google.com https://moku-nft-nextjs-s3.s3.us-east-2.amazonaws.com;
        font-src 'self';
        connect-src 'self' https://*.supabase.co https://vercel.live;
        worker-src 'self' blob:;
        frame-src 'self' https://vercel.live;
    `.replace(/\s{2,}/g, ' ').trim();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    response.headers.set('Content-Security-Policy', cspHeader);
    // Keep other security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    return response;
}

export const config = {
    matcher: [
        // Apply to all routes except static files and API routes
        {
            source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|xml|css|js|woff|woff2|ttf|eot|mp4|webm)).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
};

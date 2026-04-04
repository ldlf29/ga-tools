import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/** GET: generate a random nonce, stored in a short-lived httpOnly cookie */
export async function GET() {
  const nonce = crypto.randomBytes(16).toString('hex');
  const response = NextResponse.json({ nonce });
  response.cookies.set('ga_siwe_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60, // 5 minutes
    path: '/',
  });
  return response;
}

/**
 * Server-side helper: validate and consume the nonce stored in the request cookie.
 * Returns the nonce if valid, or null if missing/expired.
 * The caller is responsible for clearing the cookie in the response.
 */
export function consumeNonce(req: NextRequest): string | null {
  const nonce = req.cookies.get('ga_siwe_nonce')?.value;
  return nonce || null;
}

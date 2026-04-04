import { NextResponse } from 'next/server';
import crypto from 'crypto';

// In-memory nonce store with 5-minute TTL
const nonceStore = new Map<string, number>();

// Cleanup expired nonces every 60s
setInterval(() => {
  const now = Date.now();
  for (const [nonce, exp] of nonceStore) {
    if (exp < now) nonceStore.delete(nonce);
  }
}, 60_000);

export const dynamic = 'force-dynamic';

/** GET: generate a random nonce for SIWE */
export async function GET() {
  const nonce = crypto.randomBytes(16).toString('hex');
  nonceStore.set(nonce, Date.now() + 5 * 60 * 1000); // 5 min TTL
  return NextResponse.json({ nonce });
}

/** Used by auth/wallet to validate+consume a nonce */
export function consumeNonce(nonce: string): boolean {
  const exp = nonceStore.get(nonce);
  if (!exp) return false;
  if (Date.now() > exp) {
    nonceStore.delete(nonce);
    return false;
  }
  nonceStore.delete(nonce); // one-time use
  return true;
}

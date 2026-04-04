import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface AccessResult {
  walletAddress: string;
  isTestMode: boolean;
  planType: string;
  expiresAt: string;
}

export class AuthError extends Error {
  constructor(public code: 'NO_SESSION' | 'INVALID_SESSION' | 'NO_ACCESS') {
    super(code);
    this.name = 'AuthError';
  }
}

/**
 * Server-side auth check — call from any API route handler.
 * Reads the httpOnly cookie, verifies JWT, then checks Supabase for an active subscription.
 */
export async function requirePredictionsAccess(): Promise<AccessResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get('ga_predictions_session')?.value;

  if (!token) throw new AuthError('NO_SESSION');

  let walletAddress: string;
  try {
    const secret = new TextEncoder().encode(process.env.PREDICTIONS_JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    walletAddress = payload.wallet as string;
    if (!walletAddress) throw new Error('No wallet claim');
  } catch {
    throw new AuthError('INVALID_SESSION');
  }

  const { data } = await supabaseAdmin
    .from('predictions_subscriptions')
    .select('plan_type, expires_at, is_test_mode')
    .eq('wallet_address', walletAddress)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) throw new AuthError('NO_ACCESS');

  return {
    walletAddress,
    isTestMode: data.is_test_mode ?? false,
    planType: data.plan_type,
    expiresAt: data.expires_at,
  };
}

/**
 * Lightweight JWT-only check for middleware (no DB call).
 * Used in Next.js middleware to block unauthenticated requests at the edge
 * before they hit ISR cache or route handler.
 */
export async function verifySessionToken(token: string): Promise<{ wallet: string }> {
  const secret = new TextEncoder().encode(process.env.PREDICTIONS_JWT_SECRET!);
  const { payload } = await jwtVerify(token, secret);
  if (!payload.wallet) throw new Error('No wallet in token');
  return { wallet: payload.wallet as string };
}

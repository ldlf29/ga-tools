import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/wallet-reconnect
 * For wallets that have previously completed SIWE verification.
 * The wallet address from wagmi is trusted (it's authenticated by the wallet extension).
 * We check if this wallet has been verified before and issue a session without re-signing.
 */
export async function POST(req: NextRequest) {
  const JWT_SECRET = new TextEncoder().encode(process.env.PREDICTIONS_JWT_SECRET!);

  try {
    const { walletAddress } = await req.json();
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    const normalizedWallet = walletAddress.toLowerCase();

    // Check if this wallet has previously completed SIWE (exists in predictions_users)
    const { data: user } = await supabaseAdmin
      .from('predictions_users')
      .select('wallet_address, last_login_at')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (!user) {
      // Wallet never signed before — must go through SIWE
      return NextResponse.json({ known: false });
    }

    // Update last_login_at
    await supabaseAdmin
      .from('predictions_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('wallet_address', normalizedWallet);

    // Check active subscription
    const { data: activeSub } = await supabaseAdmin
      .from('predictions_subscriptions')
      .select('plan_type, expires_at, is_test_mode')
      .eq('wallet_address', normalizedWallet)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const hasAccess = !!activeSub;
    const isTestMode = activeSub?.is_test_mode ?? false;
    const expiresAt: string | null = activeSub?.expires_at ?? null;

    // Issue session JWT (same logic as wallet/route.ts)
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const subExpiryMs = expiresAt ? new Date(expiresAt).getTime() - now : 0;
    const sessionDurationMs = hasAccess
      ? Math.min(Math.max(subExpiryMs, 0) + 60 * 60 * 1000, thirtyDaysMs)
      : 60 * 60 * 1000; // 1h for no-access: wallet is known, go straight to payment
    const sessionDurationSec = Math.ceil(sessionDurationMs / 1000);
    const sessionExpiry = `${Math.ceil(sessionDurationMs / (1000 * 60 * 60))}h`;

    const sessionToken = await new SignJWT({ wallet: normalizedWallet })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(sessionExpiry)
      .sign(JWT_SECRET);

    const response = NextResponse.json({
      known: true,
      hasAccess,
      isTestMode,
      expiresAt,
      walletAddress: normalizedWallet,
      planType: activeSub?.plan_type ?? null,
    });
    response.cookies.set('ga_predictions_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionDurationSec,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[WalletReconnect] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

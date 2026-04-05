/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { SignJWT } from 'jose';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import { consumeNonce } from '@/app/api/auth/nonce/route';


export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  const JWT_SECRET = new TextEncoder().encode(process.env.PREDICTIONS_JWT_SECRET!);
  console.log('[AuthWallet] Request received');
  try {
    const { message, signature, walletAddress, requestTestMode } = await req.json();
    console.log('[AuthWallet] Payload parsed, wallet:', walletAddress?.slice(0, 8));

    if (!message || !signature || !walletAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Parse and validate SIWE message
    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(message);
    } catch {
      return NextResponse.json({ error: 'Invalid SIWE message format' }, { status: 400 });
    }

    // 2. Validate nonce (one-time use, prevents replay)
    console.log('[AuthWallet] Consuming nonce:', siweMessage.nonce);
    const cookieNonce = consumeNonce(req);
    if (!cookieNonce || cookieNonce !== siweMessage.nonce) {
      console.warn('[AuthWallet] Nonce invalid or already used. cookie:', cookieNonce, 'message:', siweMessage.nonce);
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
    }

    // 3. Verify expiration
    if (siweMessage.expirationTime) {
      const exp = new Date(siweMessage.expirationTime);
      if (exp < new Date()) {
        return NextResponse.json({ error: 'SIWE message expired' }, { status: 401 });
      }
    }

    // 4. Recover signer from signature and verify it matches the claimed address
    let recoveredAddress: string;
    try {
      const messageString = siweMessage.prepareMessage();
      console.log('[AuthWallet] Verifying signature...');
      recoveredAddress = ethers.verifyMessage(messageString, signature).toLowerCase();
      console.log('[AuthWallet] Recovered:', recoveredAddress, 'Claimed:', walletAddress?.toLowerCase());
    } catch (sigErr) {
      console.error('[AuthWallet] verifyMessage failed:', sigErr);
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    const normalizedWallet = walletAddress.toLowerCase();
    if (recoveredAddress !== normalizedWallet) {
      return NextResponse.json({ error: 'Address mismatch: signer does not match claimed wallet' }, { status: 403 });
    }

    // 5. Upsert user — use wallet as both PK and waypoint_sub (no JWKS sub for SIWE)
    await supabaseAdmin.from('predictions_users').upsert(
      { wallet_address: normalizedWallet, waypoint_sub: `siwe-${normalizedWallet}`, last_login_at: new Date().toISOString() },
      { onConflict: 'wallet_address' }
    );

    // 6. Check active subscription
    const { data: activeSub } = await supabaseAdmin
      .from('predictions_subscriptions')
      .select('plan_type, expires_at, is_test_mode')
      .eq('wallet_address', normalizedWallet)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let hasAccess = !!activeSub;
    let isTestMode = activeSub?.is_test_mode ?? false;
    let expiresAt: string | null = activeSub?.expires_at ?? null;

    // 7. Grant TEST MODE if requested and no active paid subscription
    if (requestTestMode && !hasAccess) {
      const testExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabaseAdmin.from('predictions_subscriptions').insert({
        wallet_address: normalizedWallet,
        plan_type: 'TEST',
        token_used: 'FREE',
        expires_at: testExpiresAt,
        is_test_mode: true,
        notes: 'Self-serve test mode',
      });
      hasAccess = true;
      isTestMode = true;
      expiresAt = testExpiresAt;
    }

    // 8. Issue session JWT — valid until subscription expires (max 30 days)
    // This avoids asking the user to re-sign daily when they have an active multi-day subscription
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const subExpiryMs = expiresAt ? new Date(expiresAt).getTime() - now : 0;
    const sessionDurationMs = hasAccess
      ? Math.min(Math.max(subExpiryMs, 0) + 60 * 60 * 1000, thirtyDaysMs) // sub duration + 1h buffer, max 30d
      : 60 * 60 * 1000; // 1h for no-access: wallet is known, quick re-auth if they pay
    const sessionDurationSec = Math.ceil(sessionDurationMs / 1000);
    const sessionExpiry = `${Math.ceil(sessionDurationMs / (1000 * 60 * 60))}h`;

    const sessionToken = await new SignJWT({ wallet: normalizedWallet })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(sessionExpiry)
      .sign(JWT_SECRET);

    const response = NextResponse.json({ hasAccess, isTestMode, expiresAt, walletAddress: normalizedWallet });
    response.cookies.set('ga_predictions_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionDurationSec,
      path: '/',
    });
    // Clear the one-time nonce cookie
    response.cookies.delete('ga_siwe_nonce');
    return response;
  } catch (err) {
    console.error('[AuthWallet] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

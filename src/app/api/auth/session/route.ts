import { NextResponse } from 'next/server';
import { requirePredictionsAccess, AuthError } from '@/lib/auth-middleware';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// GET: check current session status
export async function GET() {
  try {
    const access = await requirePredictionsAccess();
    return NextResponse.json({ hasAccess: true, ...access });
  } catch (err) {
    const code = err instanceof AuthError ? err.code : 'ERROR';
    // If there is a valid JWT but no active subscription, still return the wallet address
    // so the frontend can skip SIWE and send them straight to the payment screen
    if (code === 'NO_ACCESS') {
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get('ga_predictions_session')?.value;
        if (token) {
          const secret = new TextEncoder().encode(process.env.PREDICTIONS_JWT_SECRET!);
          const { payload } = await jwtVerify(token, secret);
          const walletAddress = payload.wallet as string;
          if (walletAddress) {
            return NextResponse.json({ hasAccess: false, reason: code, walletAddress, isSigned: true });
          }
        }
      } catch { /* JWT invalid or expired — fall through */ }
    }
    return NextResponse.json({ hasAccess: false, reason: code });
  }
}

// DELETE: logout — clear the session cookie
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('ga_predictions_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}

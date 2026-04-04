import { NextResponse } from 'next/server';
import { requirePredictionsAccess, AuthError } from '@/lib/auth-middleware';

// GET: check current session status
export async function GET() {
  try {
    const access = await requirePredictionsAccess();
    return NextResponse.json({ hasAccess: true, ...access });
  } catch (err) {
    const code = err instanceof AuthError ? err.code : 'ERROR';
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

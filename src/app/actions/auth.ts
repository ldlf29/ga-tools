'use server';

import { cookies } from 'next/headers';

// These can be moved to .env.local for better security
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'ga-tools-2026';

/**
 * Verifies admin credentials on the server and sets a session cookie.
 * This ensures credentials are never sent to the browser JS bundle.
 */
export async function verifyAdminAction(user: string, pass: string) {
  // Simple equality check for now as requested
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    const cookieStore = await cookies();
    
    // Set a secure, httpOnly session cookie
    cookieStore.set('ga_admin_session', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // Persists for 1 week as requested
      path: '/',
    });

    return { success: true };
  }

  return { success: false, error: 'Invalid username or password' };
}

/**
 * Checks if the user is currently an authorized admin.
 */
export async function checkAdminAction() {
  const cookieStore = await cookies();
  const session = cookieStore.get('ga_admin_session');
  return session?.value === 'true';
}

/**
 * Logs out the admin by deleting the session cookie.
 */
export async function logoutAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete('ga_admin_session');
}

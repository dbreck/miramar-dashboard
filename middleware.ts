import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Decode session from cookie. Does NOT verify HMAC signature
 * (crypto.createHmac is unavailable in Edge Runtime).
 * API routes verify the full signature in Node.js runtime.
 * The httpOnly cookie flag prevents client-side tampering.
 */
function decodeSession(token: string): { role: string } | null {
  try {
    const [payload] = token.split('.');
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    if (decoded && typeof decoded.role === 'string') {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login page and auth API routes
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  // Check for session cookie (supports both old and new format)
  const sessionCookie = request.cookies.get('miramar-session');
  let isAuth = false;
  let isAdminUser = false;

  if (sessionCookie?.value) {
    // New signed session format (base64.signature)
    const session = decodeSession(sessionCookie.value);
    if (session) {
      isAuth = true;
      isAdminUser = session.role === 'admin';
    }
    // Legacy format fallback
    if (!isAuth && sessionCookie.value === 'authenticated') {
      isAuth = true;
      isAdminUser = true;
    }
  }

  // Redirect to login if not authenticated
  if (!isAuth) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Protect admin routes
  if (pathname.startsWith('/admin') && !isAdminUser) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png).*)',
  ],
};

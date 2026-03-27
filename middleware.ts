import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHmac } from 'crypto';

function getSecret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-me';
}

function verifySession(token: string): { role: string } | null {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expectedSig = createHmac('sha256', getSecret()).update(payload).digest('hex');
    if (signature !== expectedSig) return null;

    return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
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
    // New signed session format
    const session = verifySession(sessionCookie.value);
    if (session) {
      isAuth = true;
      isAdminUser = session.role === 'admin';
    }
    // Legacy format fallback
    if (!isAuth && sessionCookie.value === 'authenticated') {
      isAuth = true;
      isAdminUser = true; // Legacy sessions get admin access
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
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png).*)',
  ],
};

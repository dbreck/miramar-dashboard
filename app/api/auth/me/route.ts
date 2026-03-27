import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';

export async function GET() {
  // Try new signed session first
  const session = await getSession();
  if (session) {
    return NextResponse.json({
      userId: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      permissions: session.permissions || { reconcile: session.role === 'admin' },
    });
  }

  // Legacy fallback: old "authenticated" cookie gets admin access
  const cookieStore = await cookies();
  const legacyCookie = cookieStore.get('miramar-session');
  if (legacyCookie?.value === 'authenticated') {
    return NextResponse.json({
      userId: 'legacy',
      email: 'admin@miramar.com',
      name: 'Admin',
      role: 'admin',
      permissions: { reconcile: true },
    });
  }

  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}

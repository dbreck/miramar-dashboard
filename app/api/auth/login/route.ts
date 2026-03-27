import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { validateUserPassword, ensureDefaultAdmin } from '@/lib/users';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // If email provided, do per-user auth
    if (email) {
      await ensureDefaultAdmin();
      const user = await validateUserPassword(email, password);
      if (!user) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      await createSession({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.role === 'admin' ? { reconcile: true } : (user.permissions || { reconcile: false }),
      });

      return NextResponse.json({
        success: true,
        user: { email: user.email, name: user.name, role: user.role },
      });
    }

    // No email — fallback to single-password auth (backward compat)
    const validPassword = process.env.DASHBOARD_PASSWORD || 'miramar2025';
    if (password !== validPassword) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    await createSession({
      userId: 'default-admin',
      email: 'admin@miramar.com',
      name: 'Admin',
      role: 'admin',
      permissions: { reconcile: true },
    });

    return NextResponse.json({
      success: true,
      user: { email: 'admin@miramar.com', name: 'Admin', role: 'admin' },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}

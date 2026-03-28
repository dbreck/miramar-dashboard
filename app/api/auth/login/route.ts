import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { validateUserPassword, ensureDefaultAdmin } from '@/lib/users';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

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
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}

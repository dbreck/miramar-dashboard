import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listUsers, createUser, updateUser, deleteUser } from '@/lib/users';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  return NextResponse.json({ users: listUsers() });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { email, name, password, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!['admin', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Role must be admin or viewer' }, { status: 400 });
    }

    const user = createUser(email, name || '', password, role);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { id, name, role, password } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (role && !['admin', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Role must be admin or viewer' }, { status: 400 });
    }

    const updates: { name?: string; role?: 'admin' | 'viewer'; password?: string } = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (password !== undefined) updates.password = password;

    const user = updateUser(id, updates);
    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent self-deletion
    if (id === session.userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

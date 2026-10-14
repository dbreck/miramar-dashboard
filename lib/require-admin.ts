import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type AccessProfile = {
  userId: string;
  role: 'admin' | 'viewer';
  can_reconcile: boolean;
  can_view_llr: boolean;
};

/** Load the signed-in caller's profile, or null when not signed in. */
export async function currentProfile(): Promise<AccessProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, can_reconcile, can_view_llr')
    .eq('id', user.id)
    .single();
  if (!profile) return null;

  return {
    userId: user.id,
    role: profile.role,
    can_reconcile: !!profile.can_reconcile,
    can_view_llr: !!profile.can_view_llr,
  };
}

/** Server-side admin gate for API routes. Null unless the caller is a signed-in admin. */
export async function requireAdmin(): Promise<{ userId: string } | null> {
  const p = await currentProfile();
  return p?.role === 'admin' ? { userId: p.userId } : null;
}

/** Admin, or a viewer with the Reconcile permission. */
export async function requireReconcile(): Promise<{ userId: string } | null> {
  const p = await currentProfile();
  if (!p) return null;
  return p.role === 'admin' || p.can_reconcile ? { userId: p.userId } : null;
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return null;
  return { userId: user.id };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const adminClient = createAdminClient();

  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const {
    data: { users: authUsers },
    error: authUsersError,
  } = await adminClient.auth.admin.listUsers();

  if (authUsersError) {
    return NextResponse.json({ error: authUsersError.message }, { status: 500 });
  }

  const authUserMap = new Map(
    authUsers.map((u) => [u.id, { last_sign_in_at: u.last_sign_in_at }])
  );

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    name: p.full_name || "",
    role: p.role,
    permissions: {
      reconcile: p.role === "admin" || p.can_reconcile,
      llr: p.role === "admin" || p.can_view_llr,
    },
    createdAt: p.created_at,
    last_sign_in_at: authUserMap.get(p.id)?.last_sign_in_at ?? null,
  }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { email, name, password, role, permissions } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!["admin", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be admin or viewer" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: newUserData, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
        user_metadata: { full_name: name || "" },
      });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // Create profile row (no trigger — we do it explicitly)
    const { error: profileError } = await adminClient
      .from("profiles")
      .insert({
        id: newUserData.user.id,
        email: email.toLowerCase(),
        full_name: name || "",
        role: role || "viewer",
        can_reconcile: permissions?.reconcile || false,
        can_view_llr: permissions?.llr || false,
      });

    if (profileError) {
      // Auth user was created but profile failed — clean up
      await adminClient.auth.admin.deleteUser(newUserData.user.id);
      return NextResponse.json({ error: "Failed to create profile: " + profileError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        user: {
          id: newUserData.user.id,
          email: newUserData.user.email,
          name: name || "",
          role,
          permissions: {
            reconcile: role === "admin" || permissions?.reconcile || false,
            llr: role === "admin" || permissions?.llr || false,
          },
          createdAt: newUserData.user.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { id, name, role, password, permissions } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (role && !["admin", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be admin or viewer" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const profileUpdate: Record<string, unknown> = {};
    if (name !== undefined) profileUpdate.full_name = name;
    if (role !== undefined) profileUpdate.role = role;
    if (permissions?.reconcile !== undefined) {
      profileUpdate.can_reconcile = permissions.reconcile;
    }
    if (permissions?.llr !== undefined) {
      profileUpdate.can_view_llr = permissions.llr;
    }

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdate)
        .eq("id", id);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    }

    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }
      const { error: pwError } = await adminClient.auth.admin.updateUserById(id, {
        password,
      });
      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 400 });
      }
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.full_name || "",
        role: profile.role,
        permissions: {
          reconcile: profile.role === "admin" || profile.can_reconcile,
          llr: profile.role === "admin" || profile.can_view_llr,
        },
        createdAt: profile.created_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (id === session.userId) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

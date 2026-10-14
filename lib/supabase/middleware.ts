import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated users -> redirect to /login
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/_next") &&
    !request.nextUrl.pathname.startsWith("/favicon") &&
    !request.nextUrl.pathname.startsWith("/api")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated users at /login -> redirect to dashboard
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Role / permission enforcement for protected pages (API routes enforce their own).
  // /admin/*          -> role = admin
  // /reconciliation/* -> role = admin OR can_reconcile
  if (user) {
    const path = request.nextUrl.pathname;
    const needsAdmin = path === "/admin" || path.startsWith("/admin/");
    const needsReconcile =
      path === "/reconciliation" || path.startsWith("/reconciliation/");

    if (needsAdmin || needsReconcile) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, can_reconcile")
        .eq("id", user.id)
        .single();

      const isAdmin = profile?.role === "admin";
      const allowed = needsAdmin ? isAdmin : isAdmin || !!profile?.can_reconcile;

      if (!allowed) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "?denied=1";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

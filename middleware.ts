import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const hasOAuthCallbackParams =
    request.nextUrl.searchParams.has("code") ||
    request.nextUrl.searchParams.has("error_code") ||
    request.nextUrl.searchParams.get("error") === "access_denied";

  if (
    hasOAuthCallbackParams &&
    !request.nextUrl.pathname.startsWith("/auth/callback")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // Next.js prefetches every visible <Link> in the background. Those
  // requests run in parallel with real navigations and can race to refresh
  // the same rotating Supabase refresh token — the loser gets "already
  // used" and Supabase revokes the whole session, logging the user out of
  // a session that was otherwise still good. Skip auth handling for them.
  if (
    request.method === "GET" &&
    !request.nextUrl.pathname.startsWith("/api/") &&
    (request.headers.get("next-router-prefetch") === "1" ||
      request.headers.get("purpose") === "prefetch")
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/reset-password") ||
    request.nextUrl.pathname.startsWith("/auth/setup") ||
    request.nextUrl.pathname.startsWith("/auth/callback");

  if (!user && !isPublicAuthRoute) {
    if (request.nextUrl.pathname.startsWith("/api/"))
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    !isPublicAuthRoute &&
    request.nextUrl.pathname !== "/access-paused"
  ) {
    const { data: access, error } = await supabase
      .from("account_access")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error)
      return new NextResponse(
        "Account access could not be verified. Please try again.",
        { status: 503 },
      );
    if (access && access.status !== "active") {
      if (request.nextUrl.pathname.startsWith("/api/"))
        return NextResponse.json(
          { error: "Your account access is paused." },
          { status: 403 },
        );
      const url = request.nextUrl.clone();
      url.pathname =
        access.status === "pending" ? "/auth/setup" : "/access-paused";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return response;
}

export const config = {
  // Public static assets (logo, icons, manifest, etc.) must stay reachable
  // even when logged out — otherwise the login page itself can't show the
  // logo, and a browser can't fetch the manifest to offer "Add to Home
  // Screen," since the middleware would redirect those requests to /login too.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif)$).*)",
  ],
};

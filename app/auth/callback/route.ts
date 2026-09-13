import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl.clone();
  const code = requestUrl.searchParams.get("code");
  const errorCode = requestUrl.searchParams.get("error_code") || requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const nextParam = requestUrl.searchParams.get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") && !nextParam.includes('\\') ? nextParam : "/";

  if (errorCode || errorDescription) {
    const url = new URL("/login", requestUrl.origin);
    url.searchParams.set("error", "auth");
    if (errorCode) url.searchParams.set("error_code", errorCode);
    if (errorDescription) url.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(url);
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    const url = new URL("/login", requestUrl.origin);
    url.searchParams.set("error", "auth");
    url.searchParams.set(
      "error_code",
      error.message.toLowerCase().includes("code verifier") ? "pkce_verifier_missing" : "callback_failed"
    );
    return NextResponse.redirect(url);
  }

  // Supabase invitations use an implicit hash-token flow (not PKCE).
  // A redirect preserves that fragment for the setup page to consume.
  if (next === '/auth/setup') return NextResponse.redirect(new URL(next, requestUrl.origin));
  return NextResponse.redirect(new URL("/login?error=auth", requestUrl.origin));
}

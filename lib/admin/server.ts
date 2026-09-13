import "server-only";
import { createClient as supabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { RequestError } from "./validation";

export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new RequestError(
      "Admin services are not configured. Contact the site owner.",
      503,
    );
  return supabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
export async function requireUser(allowPending = false) {
  const client = createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new RequestError("Please sign in.", 401);
  const { data: access, error: accessError } = await client
    .from("account_access")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (accessError)
    throw new RequestError(
      "Account access could not be verified. Please try again.",
      503,
    );
  if (
    access &&
    access.status !== "active" &&
    !(allowPending && access.status === "pending")
  )
    throw new RequestError(
      "Your account access is paused. Contact the site owner.",
      403,
    );
  return { client, user };
}
export async function requireAdmin() {
  const auth = await requireUser();
  const { data, error } = await auth.client.rpc("is_apex_admin");
  if (error || data !== true)
    throw new RequestError("Admin access required.", 403);
  return { ...auth, db: serviceClient() };
}
export function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export function failure(error: unknown) {
  if (error instanceof RequestError)
    return Response.json({ error: error.message }, { status: error.status });
  // Do not return SQL details, secrets, or auth-provider responses to clients.
  console.error(
    "ApexLoad admin operation failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    { error: "The change could not be completed. Please try again." },
    { status: 500 },
  );
}

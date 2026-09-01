import AccountSettings from "@/components/AccountSettings";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <main className="apex-page">
      <header>
        <p className="apex-kicker">Account</p>
        <h1 className="apex-title">Settings</h1>
      </header>

      {user && (
        <AccountSettings
          email={user.email ?? ""}
          displayName={profile?.display_name ?? null}
        />
      )}
    </main>
  );
}

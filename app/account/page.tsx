import AccountSettings from "@/components/AccountSettings";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
    : { data: null };
  const { data: admin } = user ? await supabase.rpc('is_apex_admin') : {data:false};

  return (
    <main className="apex-page">
      <header>
        <p className="apex-kicker">Account</p>
        <h1 className="apex-title">Settings</h1>
      </header>

      {admin === true && <Link href="/admin" className="apex-action-primary mt-6"><div><p>Admin dashboard</p><p className="text-xs font-normal mt-1">Feedback, users, content, and app settings</p></div><span>→</span></Link>}
      {user && (
        <AccountSettings
          email={user.email ?? ""}
          displayName={profile?.display_name ?? null}
        />
      )}
    </main>
  );
}

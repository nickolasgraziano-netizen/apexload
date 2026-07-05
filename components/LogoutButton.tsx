"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logOut}
      disabled={loading}
      className="rounded-lg border border-steel-600 px-3 py-1.5 font-mono text-xs text-chalk-300 disabled:opacity-50"
    >
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}

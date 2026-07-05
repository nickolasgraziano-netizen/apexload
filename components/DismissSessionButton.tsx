"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DismissSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);

  async function dismiss() {
    setDismissing(true);
    const supabase = createClient();
    await supabase
      .from("sessions")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", sessionId);
    router.refresh();
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
      }}
      disabled={dismissing}
      className="shrink-0 rounded-lg border border-tungsten-500 px-2 py-1 font-mono text-[10px] uppercase text-tungsten-400 disabled:opacity-50"
    >
      {dismissing ? "…" : "Remove"}
    </button>
  );
}

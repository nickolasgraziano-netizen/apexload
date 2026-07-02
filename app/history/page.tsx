"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface HistoryDay {
  sessionId: string;
  muscleGroupName: string;
  startedAt: string;
  endedAt: string | null;
  setCount: number;
}

export default function HistoryPage() {
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    const supabase = createClient();
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, started_at, ended_at, muscle_groups ( name )")
      .order("started_at", { ascending: false });

    const sessionIds = (sessions ?? []).map((s: any) => s.id);
    const { data: sets } = sessionIds.length
      ? await supabase.from("sets").select("session_id").in("session_id", sessionIds)
      : { data: [] };

    const setCounts = new Map<string, number>();
    for (const s of sets ?? []) {
      setCounts.set(s.session_id, (setCounts.get(s.session_id) ?? 0) + 1);
    }

    setDays(
      (sessions ?? []).map((s: any) => ({
        sessionId: s.id,
        muscleGroupName: s.muscle_groups?.name ?? "Unknown",
        startedAt: s.started_at,
        endedAt: s.ended_at,
        setCount: setCounts.get(s.id) ?? 0,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function deleteDay(sessionId: string) {
    if (!confirm("Delete this workout? This can't be undone.")) return;
    setDeletingId(sessionId);
    const supabase = createClient();
    await supabase.from("sessions").delete().eq("id", sessionId);
    setDays((prev) => prev.filter((d) => d.sessionId !== sessionId));
    setDeletingId(null);
  }

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-copper-500">ApexLoad</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">History</h1>
        </div>
        <Link href="/" className="font-mono text-xs text-chalk-500 underline">
          Home
        </Link>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-chalk-500">Loading…</p>
      ) : days.length === 0 ? (
        <p className="mt-6 text-sm text-chalk-500">No workouts logged yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {days.map((d) => (
            <li
              key={d.sessionId}
              className="flex items-center justify-between rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
            >
              <div>
                <p className="text-chalk-100">{d.muscleGroupName}</p>
                <p className="mt-0.5 font-mono text-xs text-chalk-500">
                  {new Date(d.startedAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}
                  {d.setCount} {d.setCount === 1 ? "set" : "sets"}
                </p>
              </div>
              <button
                onClick={() => deleteDay(d.sessionId)}
                disabled={deletingId === d.sessionId}
                className="rounded-lg border border-copper-600 px-3 py-1.5 text-xs text-copper-400 disabled:opacity-50"
              >
                {deletingId === d.sessionId ? "Deleting…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

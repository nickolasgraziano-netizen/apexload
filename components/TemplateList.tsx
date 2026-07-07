"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startWorkoutTemplate } from "@/lib/templates";
import type { WorkoutTemplate } from "@/lib/types";

export default function TemplateList({
  templates,
  userId,
}: {
  templates: WorkoutTemplate[];
  userId: string;
}) {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);

  async function startTemplate(template: WorkoutTemplate) {
    setStartingId(template.id);
    const supabase = createClient();
    const sessionId = await startWorkoutTemplate(supabase, userId, template.id);
    if (!sessionId) {
      setStartingId(null);
      return;
    }
    router.push(`/workout/${sessionId}`);
  }

  if (templates.length === 0) return null;

  return (
    <section className="mt-6 flex flex-col gap-2">
      <h3 className="font-mono text-xs uppercase tracking-widest text-chalk-500">Templates</h3>
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
        >
          <Link href={`/workout/plan/${t.id}`} className="min-w-0">
            <span className="text-chalk-100">{t.name}</span>
            {t.notes && <p className="mt-0.5 text-xs text-chalk-500">{t.notes}</p>}
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/workout/plan/edit/${t.id}`}
              className="rounded-lg border border-steel-600 px-3 py-1.5 text-xs text-chalk-300"
            >
              Edit
            </Link>
            <button
              onClick={() => startTemplate(t)}
              disabled={startingId === t.id}
              className="rounded-lg bg-copper-500 px-3 py-1.5 text-xs font-semibold text-steel-950 disabled:opacity-50"
            >
              {startingId === t.id ? "Starting…" : "Start"}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

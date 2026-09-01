"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteWorkoutTemplate, startWorkoutTemplate } from "@/lib/templates";
import type { WorkoutTemplate } from "@/lib/types";

export default function TemplateList({
  templates,
  userId,
}: {
  templates: WorkoutTemplate[];
  userId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(templates);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setItems(templates);
  }, [templates]);

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

  async function deleteTemplate(template: WorkoutTemplate) {
    if (!confirm(`Delete "${template.name}"? This can't be undone.`)) return;
    setDeletingId(template.id);
    const supabase = createClient();
    const ok = await deleteWorkoutTemplate(supabase, template.id);
    if (ok) {
      setItems((prev) => prev.filter((t) => t.id !== template.id));
    }
    setDeletingId(null);
  }

  if (items.length === 0) return null;

  return (
    <section className="apex-section flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="apex-section-title">Templates</h3>
        <span className="apex-chip">{items.length} saved</span>
      </div>
      {items.map((t) => (
        <div
          key={t.id}
          onClick={() => router.push(`/workout/plan/${t.id}`)}
          className="apex-card flex cursor-pointer items-center justify-between gap-3 active:bg-steel-800"
        >
          <div className="min-w-0">
            <span className="font-semibold text-chalk-100">{t.name}</span>
            {t.notes && <p className="mt-0.5 text-xs text-chalk-500">{t.notes}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/workout/plan/edit/${t.id}`}
              onClick={(e) => e.stopPropagation()}
              className="apex-secondary-button"
            >
              Edit
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                startTemplate(t);
              }}
              disabled={startingId === t.id}
              className="rounded-lg bg-copper-500 px-3 py-2 text-xs font-semibold text-steel-950 disabled:opacity-50"
            >
              {startingId === t.id ? "Starting…" : "Start"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteTemplate(t);
              }}
              disabled={deletingId === t.id}
              aria-label="Delete plan"
              className="apex-danger-button px-2 disabled:opacity-50"
            >
              {deletingId === t.id ? "…" : "✕"}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import TemplateList from "@/components/TemplateList";
import type { WorkoutTemplate } from "@/lib/types";

// Starting a workout is just two choices: build one from scratch (which
// saves as a reusable template automatically), or reuse one you've already
// got — a saved template or a past day from History. No suggestions.
export default function WorkoutChooser() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: tpl }, { data: userRes }] = await Promise.all([
        supabase.from("workout_templates").select("*").order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      setTemplates((tpl ?? []) as WorkoutTemplate[]);
      setUserId(userRes?.user?.id ?? null);
    })();
  }, []);

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <p className="font-mono text-xs uppercase tracking-widest text-copper-500">Set up</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">
        Start a workout
      </h1>

      <Link
        href="/workout/build"
        className="mt-6 flex items-center justify-between rounded-xl border border-steel-700/60 bg-steel-900/60 px-4 py-3 backdrop-blur-md"
      >
        <div>
          <p className="text-chalk-100">Build a new workout</p>
          <p className="mt-0.5 text-xs text-chalk-500">
            Name it, add exercises one at a time, start logging right away
          </p>
        </div>
        <span className="font-mono text-xs text-copper-400">→</span>
      </Link>
      <Link
        href="/workout/plan"
        className="mt-2 flex items-center justify-between rounded-xl border border-steel-700/60 bg-steel-900/60 px-4 py-3 backdrop-blur-md"
      >
        <div>
          <p className="text-chalk-100">Plan a workout for later</p>
          <p className="mt-0.5 text-xs text-chalk-500">
            Save it now, no live logging — start it whenever you're ready
          </p>
        </div>
        <span className="font-mono text-xs text-copper-400">→</span>
      </Link>

      {userId && <TemplateList templates={templates} userId={userId} />}

      <section className="mt-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          Or reuse a past workout
        </h2>
        <Link
          href="/history"
          className="mt-2 flex items-center justify-between rounded-xl border border-steel-700/60 bg-steel-900/60 px-4 py-3 backdrop-blur-md"
        >
          <div>
            <p className="text-chalk-100">Repeat from History</p>
            <p className="mt-0.5 text-xs text-chalk-500">Pick any day you've already done</p>
          </div>
          <span className="font-mono text-xs text-copper-400">→</span>
        </Link>
      </section>
    </main>
  );
}

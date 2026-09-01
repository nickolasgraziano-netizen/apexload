"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import TemplateList from "@/components/TemplateList";
import BruceLeeQuote from "@/components/BruceLeeQuote";
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
    <main className="apex-page">
      <p className="apex-kicker">Set up</p>
      <h1 className="apex-title">
        Start a workout
      </h1>
      <p className="apex-copy">Choose whether this is a live session, a saved plan, or a repeat from your history.</p>
      <BruceLeeQuote className="mt-4" />

      <Link
        href="/workout/build"
        className="apex-action-primary mt-6"
      >
        <div>
          <p>Build a new workout</p>
          <p className="mt-0.5 text-xs font-normal text-steel-800">
            Name it, add exercises one at a time, start logging right away
          </p>
        </div>
        <span className="font-mono text-xs">→</span>
      </Link>
      <Link
        href="/workout/plan"
        className="apex-action mt-2"
      >
        <div>
          <p className="font-semibold text-chalk-100">Plan a workout for later</p>
          <p className="mt-0.5 text-xs text-chalk-500">
            Save it now, no live logging — start it whenever you're ready
          </p>
        </div>
        <span className="font-mono text-xs text-copper-400">→</span>
      </Link>

      {userId && <TemplateList templates={templates} userId={userId} />}

      <section className="apex-section">
        <h2 className="apex-section-title">
          Or reuse a past workout
        </h2>
        <Link
          href="/history"
          className="apex-action mt-2"
        >
          <div>
            <p className="font-semibold text-chalk-100">Repeat from History</p>
            <p className="mt-0.5 text-xs text-chalk-500">Pick any day you've already done</p>
          </div>
          <span className="font-mono text-xs text-copper-400">→</span>
        </Link>
      </section>
    </main>
  );
}

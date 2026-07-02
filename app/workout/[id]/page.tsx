"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { suggestNextWeight } from "@/lib/suggestions";
import RestTimer from "@/components/RestTimer";
import SetRow from "@/components/SetRow";
import type { Exercise, LoggedSet, TrainingVariant, WorkoutSession, SetDifficulty } from "@/lib/types";

export default function ActiveWorkoutPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [plannedExercises, setPlannedExercises] = useState<Exercise[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const [allSets, setAllSets] = useState<LoggedSet[]>([]); // history for suggestion engine
  const [sessionSets, setSessionSets] = useState<LoggedSet[]>([]); // this session only
  const [previousWeekSets, setPreviousWeekSets] = useState<LoggedSet[]>([]);

  const [variant, setVariant] = useState<TrainingVariant>("standard");
  const [reps, setReps] = useState(15);
  const [weight, setWeight] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<SetDifficulty>("moderate");
  const [showTimer, setShowTimer] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const tabStripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const activeExercise = plannedExercises[activeIndex] as Exercise | undefined;

  function updateTabScrollState() {
    const el = tabStripRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  useEffect(() => {
    updateTabScrollState();
  }, [plannedExercises]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: sess } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      setSession(sess as WorkoutSession);

      const planIds: string[] = JSON.parse(
        sessionStorage.getItem(`apexload:plan:${sessionId}`) ?? "[]"
      );
      if (planIds.length > 0) {
        const { data: ex } = await supabase.from("exercises").select("*").in("id", planIds);
        const ordered = planIds
          .map((id) => (ex ?? []).find((e: Exercise) => e.id === id))
          .filter(Boolean) as Exercise[];
        setPlannedExercises(ordered);
      }

      // Previous week: most recent PRIOR session for this same muscle group.
      if (sess) {
        const { data: prevSession } = await supabase
          .from("sessions")
          .select("*")
          .eq("muscle_group_id", sess.muscle_group_id)
          .lt("started_at", sess.started_at)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevSession) {
          const { data: prevSets } = await supabase
            .from("sets")
            .select("*")
            .eq("session_id", prevSession.id);
          setPreviousWeekSets((prevSets ?? []) as LoggedSet[]);
        }
      }
    })();
  }, [sessionId]);

  // Elapsed session timer, ticking off the real start timestamp.
  useEffect(() => {
    if (!session?.started_at) return;
    const start = new Date(session.started_at).getTime();
    const interval = setInterval(() => setElapsedSec(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [session?.started_at]);

  // Load history + this-session sets whenever the active exercise changes.
  useEffect(() => {
    if (!activeExercise || !userId) return;
    const supabase = createClient();
    (async () => {
      const { data: hist } = await supabase
        .from("sets")
        .select("*")
        .eq("user_id", userId)
        .eq("exercise_id", activeExercise.id)
        .order("logged_at", { ascending: false })
        .limit(20);
      setAllSets((hist ?? []) as LoggedSet[]);

      const { data: mine } = await supabase
        .from("sets")
        .select("*")
        .eq("session_id", sessionId)
        .eq("exercise_id", activeExercise.id)
        .order("set_number");
      setSessionSets((mine ?? []) as LoggedSet[]);
    })();
  }, [activeExercise, userId, sessionId]);

  const suggestion = useMemo(() => {
    if (!activeExercise) return null;
    return suggestNextWeight(allSets, activeExercise.id, variant);
  }, [allSets, activeExercise, variant]);

  useEffect(() => {
    if (suggestion?.suggestedWeight != null) setWeight(suggestion.suggestedWeight);
  }, [suggestion]);

  async function logSet() {
    if (!activeExercise || !userId) return;
    const supabase = createClient();
    const setNumber = sessionSets.length + 1;

    const { data: newSet } = await supabase
      .from("sets")
      .insert({
        session_id: sessionId,
        user_id: userId,
        exercise_id: activeExercise.id,
        training_variant: variant,
        set_number: setNumber,
        target_reps: 15,
        actual_reps: reps,
        weight,
        difficulty,
      })
      .select()
      .single();

    if (newSet) setSessionSets((prev) => [...prev, newSet as LoggedSet]);
    setShowTimer(true);
  }

  async function updateSet(id: string, patch: Partial<LoggedSet>) {
    const supabase = createClient();
    await supabase.from("sets").update(patch).eq("id", id);
    setSessionSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function deleteSet(id: string) {
    const supabase = createClient();
    await supabase.from("sets").delete().eq("id", id);
    setSessionSets((prev) => prev.filter((s) => s.id !== id));
  }

  async function endWorkout() {
    const supabase = createClient();
    await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId);
    router.push("/");
  }

  const prevWeekForExercise = previousWeekSets.filter((s) => s.exercise_id === activeExercise?.id);

  return (
    <main className="min-h-screen px-5 pb-40 pt-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, "0")} elapsed
        </p>
        <button onClick={endWorkout} className="font-mono text-xs text-copper-400">
          End workout
        </button>
      </div>

      {plannedExercises.length > 0 && (
        <div className="relative mt-3">
          <div
            ref={tabStripRef}
            onScroll={updateTabScrollState}
            className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {plannedExercises.map((ex, i) => (
              <button
                key={ex.id}
                onClick={() => setActiveIndex(i)}
                className={`shrink-0 snap-start rounded-full px-3 py-1.5 text-xs ${
                  i === activeIndex
                    ? "bg-copper-500 text-steel-950"
                    : "border border-steel-600 text-chalk-300"
                }`}
              >
                {ex.name}
              </button>
            ))}
          </div>
          {canScrollLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-steel-950 to-transparent" />
          )}
          {canScrollRight && (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-steel-950 to-transparent" />
          )}
        </div>
      )}

      {activeExercise && (
        <>
          <h1 className="mt-4 font-display text-2xl font-extrabold text-chalk-100">
            {activeExercise.name}
          </h1>

          {prevWeekForExercise.length > 0 && (
            <div className="mt-2 rounded-xl border border-steel-700 bg-steel-900 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">
                Last week
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {prevWeekForExercise.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-md bg-steel-800 px-2 py-1 font-mono text-xs text-chalk-300"
                  >
                    {s.actual_reps}×{s.weight}
                    {s.training_variant === "tut" && (
                      <span className="ml-1 text-tungsten-400">TUT</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setVariant("standard")}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                variant === "standard"
                  ? "bg-copper-500 text-steel-950"
                  : "border border-steel-600 text-chalk-300"
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setVariant("tut")}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                variant === "tut"
                  ? "bg-tungsten-500 text-steel-950"
                  : "border border-steel-600 text-chalk-300"
              }`}
            >
              Time Under Tension
            </button>
          </div>

          {suggestion?.reason === "increase" && (
            <button
              onClick={() => setWeight((w) => w + 5)}
              className="mt-3 w-full rounded-xl border border-tungsten-500 bg-tungsten-600/10 py-2 text-sm text-tungsten-400"
            >
              Hit target easy last time — bump +5 lb?
            </button>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {sessionSets.map((s) => (
              <SetRow key={s.id} set={s} onUpdate={updateSet} onDelete={deleteSet} />
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-steel-700 bg-steel-900 p-4">
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="font-mono text-xs text-chalk-500">Reps</span>
                <input
                  type="number"
                  value={reps}
                  onChange={(e) => setReps(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100"
                />
              </label>
              <label className="flex-1">
                <span className="font-mono text-xs text-chalk-500">Weight ({"lb"})</span>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100"
                />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              {(["easy", "moderate", "difficult", "failed"] as SetDifficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 rounded-lg py-1.5 text-xs capitalize ${
                    difficulty === d
                      ? "bg-copper-500 text-steel-950"
                      : "border border-steel-600 text-chalk-300"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              onClick={logSet}
              className="mt-3 w-full rounded-xl bg-copper-500 py-3 font-semibold text-steel-950"
            >
              Log set
            </button>
          </div>
        </>
      )}

      {showTimer && activeExercise && (
        <RestTimer
          defaultSeconds={activeExercise.default_rest_seconds}
          onDismiss={() => setShowTimer(false)}
        />
      )}
    </main>
  );
}

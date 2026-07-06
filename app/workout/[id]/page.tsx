"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { suggestNextWeight } from "@/lib/suggestions";
import { buildMotivationalMessage } from "@/lib/motivation";
import RestTimer from "@/components/RestTimer";
import SetRow from "@/components/SetRow";
import type {
  Exercise,
  LoggedSet,
  TrainingVariant,
  WorkoutSession,
  SetDifficulty,
  SetSide,
} from "@/lib/types";

interface SetDraft {
  reps: number;
  weight: number;
  difficulty: SetDifficulty;
  variant: TrainingVariant;
  side: SetSide;
}

interface SupersetGroupView {
  id: string;
  exerciseIds: string[]; // ordered by position
}

const DEFAULT_DRAFT: SetDraft = {
  reps: 15,
  weight: 0,
  difficulty: "moderate",
  variant: "standard",
  side: "right",
};
const SUPERSET_SHORT_REST = 30;
const SUPERSET_LONG_REST = 60;

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
  const [machinePhotoUrl, setMachinePhotoUrl] = useState<string | null>(null);

  // Per-exercise unsaved set drafts, so hopping between exercises never loses
  // what you were about to log — interrupted sets pick back up untouched.
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>({});
  const [showTimer, setShowTimer] = useState(false);
  const [restKey, setRestKey] = useState(0); // bump to force a fresh countdown, even mid-rest
  const [justLoggedSet, setJustLoggedSet] = useState(false);
  const [motivationMessage, setMotivationMessage] = useState("");

  const [showPicker, setShowPicker] = useState(false);
  const [catalog, setCatalog] = useState<(Exercise & { muscle_groups: { name: string } | null })[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateNotes, setTemplateNotes] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");

  // Cardio exercises (elliptical, stairmaster, etc.) log a single
  // duration + intensity-notes entry per session instead of sets.
  const [cardioDurationMinutes, setCardioDurationMinutes] = useState("");
  const [cardioNotes, setCardioNotes] = useState("");
  const [cardioCalories, setCardioCalories] = useState("");
  const [cardioEditing, setCardioEditing] = useState(false);

  // Exercises the lifter skipped this session (e.g. machine unavailable) —
  // kept per-session so we can prompt to circle back before ending.
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [showEndPrompt, setShowEndPrompt] = useState(false);

  // Supersets: 2-3 exercise tabs rotated between sets. Grouping can be
  // created here on the fly (select tabs) or arrive pre-made from workout/new.
  const [supersetGroups, setSupersetGroups] = useState<SupersetGroupView[]>([]);
  const [groupingMode, setGroupingMode] = useState(false);
  const [groupingSelection, setGroupingSelection] = useState<string[]>([]);
  const [restSeconds, setRestSeconds] = useState(90);

  const tabStripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const activeExercise = plannedExercises[activeIndex] as Exercise | undefined;
  const draft = (activeExercise && drafts[activeExercise.id]) || DEFAULT_DRAFT;
  const { reps, weight, difficulty, variant, side } = draft;
  const activeGroup = activeExercise
    ? supersetGroups.find((g) => g.exerciseIds.includes(activeExercise.id))
    : undefined;
  const cardioEntry = sessionSets[0];

  function updateDraft(patch: Partial<SetDraft>) {
    if (!activeExercise) return;
    setDrafts((prev) => ({
      ...prev,
      [activeExercise.id]: { ...(prev[activeExercise.id] || DEFAULT_DRAFT), ...patch },
    }));
  }

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
      setNotes((sess as WorkoutSession)?.notes ?? "");

      setSkippedIds(
        JSON.parse(sessionStorage.getItem(`apexload:skipped:${sessionId}`) ?? "[]")
      );

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

      // Any superset groups already tied to this session — whether set up
      // during planning (workout/new) or on the fly in a prior visit here.
      const { data: groupRows } = await supabase
        .from("superset_groups")
        .select("id, superset_group_exercises ( exercise_id, position )")
        .eq("session_id", sessionId);
      setSupersetGroups(
        (groupRows ?? []).map((g: any) => ({
          id: g.id,
          exerciseIds: (g.superset_group_exercises ?? [])
            .sort((a: any, b: any) => a.position - b.position)
            .map((e: any) => e.exercise_id),
        }))
      );

      // Previous week: most recent PRIOR session for this same muscle group.
      // Skipped for template-launched sessions, which have no single group.
      if (sess && sess.muscle_group_id) {
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

  // Most recent machine photo for this exercise, if one's been uploaded —
  // helps tell apart similar-looking machines at a glance.
  useEffect(() => {
    if (!activeExercise || !userId) {
      setMachinePhotoUrl(null);
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data: photo } = await supabase
        .from("machine_photos")
        .select("storage_path")
        .eq("user_id", userId)
        .eq("exercise_id", activeExercise.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!photo) {
        setMachinePhotoUrl(null);
        return;
      }
      const { data: signed } = await supabase.storage
        .from("machine-photos")
        .createSignedUrl(photo.storage_path, 3600);
      setMachinePhotoUrl(signed?.signedUrl ?? null);
    })();
  }, [activeExercise, userId]);

  const suggestion = useMemo(() => {
    if (!activeExercise) return null;
    return suggestNextWeight(allSets, activeExercise.id, variant);
  }, [allSets, activeExercise, variant]);

  // Only seed the suggested weight the first time this exercise gets a
  // draft — once the lifter has their own draft going, don't clobber it.
  useEffect(() => {
    if (!activeExercise || drafts[activeExercise.id]) return;
    if (suggestion?.suggestedWeight != null) updateDraft({ weight: suggestion.suggestedWeight });
  }, [suggestion, activeExercise]);

  // Keep the session's exercise plan (and any added on the fly) durable
  // across reloads, same key the active-workout page reads on mount.
  useEffect(() => {
    if (!sessionId || plannedExercises.length === 0) return;
    sessionStorage.setItem(
      `apexload:plan:${sessionId}`,
      JSON.stringify(plannedExercises.map((e) => e.id))
    );
  }, [plannedExercises, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    sessionStorage.setItem(`apexload:skipped:${sessionId}`, JSON.stringify(skippedIds));
  }, [skippedIds, sessionId]);

  function goToExercise(index: number) {
    setActiveIndex(index);
    setJustLoggedSet(false);
  }

  function goToNextExercise() {
    if (plannedExercises.length < 2) return;
    goToExercise((activeIndex + 1) % plannedExercises.length);
  }

  function skipExercise() {
    if (!activeExercise) return;
    setSkippedIds((prev) => (prev.includes(activeExercise.id) ? prev : [...prev, activeExercise.id]));
    goToNextExercise();
  }

  // Sync the cardio form to whichever entry (if any) exists for the active
  // exercise — keyed on ids rather than the object itself so it doesn't
  // reset mid-edit if sessionSets happens to re-render for another reason.
  useEffect(() => {
    if (!activeExercise?.is_cardio) return;
    if (cardioEntry) {
      setCardioDurationMinutes(
        cardioEntry.duration_seconds != null ? String(Math.round(cardioEntry.duration_seconds / 60)) : ""
      );
      setCardioNotes(cardioEntry.notes ?? "");
      setCardioCalories(cardioEntry.calories != null ? String(cardioEntry.calories) : "");
      setCardioEditing(false);
    } else {
      setCardioDurationMinutes("");
      setCardioNotes("");
      setCardioCalories("");
      setCardioEditing(true);
    }
  }, [activeExercise?.id, cardioEntry?.id]);

  async function saveCardio() {
    if (!activeExercise || !userId) return;
    const supabase = createClient();
    const minutes = Number(cardioDurationMinutes);
    const durationSeconds = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
    const trimmedNotes = cardioNotes.trim() || null;
    const calories = Number(cardioCalories);
    const caloriesValue = Number.isFinite(calories) && calories > 0 ? Math.round(calories) : null;

    if (cardioEntry) {
      await supabase
        .from("sets")
        .update({ duration_seconds: durationSeconds, notes: trimmedNotes, calories: caloriesValue })
        .eq("id", cardioEntry.id);
      setSessionSets((prev) =>
        prev.map((s) =>
          s.id === cardioEntry.id
            ? { ...s, duration_seconds: durationSeconds, notes: trimmedNotes, calories: caloriesValue }
            : s
        )
      );
    } else {
      const { data: newSet } = await supabase
        .from("sets")
        .insert({
          session_id: sessionId,
          user_id: userId,
          exercise_id: activeExercise.id,
          training_variant: "standard",
          set_number: 1,
          target_reps: 0,
          actual_reps: null,
          weight: null,
          difficulty: null,
          duration_seconds: durationSeconds,
          notes: trimmedNotes,
          calories: caloriesValue,
        })
        .select()
        .single();
      if (newSet) setSessionSets((prev) => [...prev, newSet as LoggedSet]);
    }

    setSkippedIds((prev) => prev.filter((id) => id !== activeExercise.id));
    setCardioEditing(false);
  }

  async function logSet() {
    if (!activeExercise || !userId) return;
    const supabase = createClient();
    const setNumber = sessionSets.length + 1;

    // Superset-aware rest: short between exercises in the cycle, long once
    // you've cycled back through every exercise in the group. Otherwise a
    // flat 30s default — adjustable in the timer itself in 15s increments.
    let rest = 30;
    if (activeGroup) {
      const isLastInGroup =
        activeGroup.exerciseIds[activeGroup.exerciseIds.length - 1] === activeExercise.id;
      rest = isLastInGroup ? SUPERSET_LONG_REST : SUPERSET_SHORT_REST;
    }

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
        superset_group_id: activeGroup?.id ?? null,
        superset_cycle: activeGroup ? setNumber : null,
        side: activeExercise.is_unilateral ? side : null,
      })
      .select()
      .single();

    if (newSet) setSessionSets((prev) => [...prev, newSet as LoggedSet]);

    // Actually doing the exercise after all un-skips it.
    setSkippedIds((prev) => prev.filter((id) => id !== activeExercise.id));

    // Alternate sides automatically — right then left, matching how a set
    // of unilateral work is actually performed.
    if (activeExercise.is_unilateral) {
      updateDraft({ side: side === "right" ? "left" : "right" });
    }

    const priorMax = Math.max(0, ...allSets.map((s) => s.weight ?? 0));
    const isPR = weight > priorMax;
    setMotivationMessage(
      buildMotivationalMessage({
        latestPR: isPR ? { exerciseName: activeExercise.name, weight } : null,
        seed: sessionSets.length + reps,
      })
    );

    setRestSeconds(rest);
    setShowTimer(true);
    setRestKey((k) => k + 1);
    setJustLoggedSet(true);
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

  async function saveNotes() {
    const supabase = createClient();
    const trimmed = notes.trim() || null;
    await supabase.from("sessions").update({ notes: trimmed }).eq("id", sessionId);
  }

  function requestEndWorkout() {
    if (skippedIds.length > 0) {
      setShowEndPrompt(true);
      return;
    }
    finishWorkout();
  }

  async function finishWorkout() {
    const supabase = createClient();
    await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId);
    sessionStorage.removeItem(`apexload:skipped:${sessionId}`);
    router.push("/");
  }

  function resumeSkippedExercise(exerciseId: string) {
    const index = plannedExercises.findIndex((e) => e.id === exerciseId);
    if (index !== -1) goToExercise(index);
    setShowEndPrompt(false);
  }

  async function saveAsTemplate() {
    if (!userId || plannedExercises.length === 0 || !templateName.trim()) return;
    setSavingTemplate(true);
    const supabase = createClient();

    const { data: template } = await supabase
      .from("workout_templates")
      .insert({ user_id: userId, name: templateName.trim(), notes: templateNotes.trim() || null })
      .select()
      .single();
    if (!template) {
      setSavingTemplate(false);
      return;
    }

    await supabase.from("workout_template_exercises").insert(
      plannedExercises.map((ex, position) => ({
        template_id: template.id,
        exercise_id: ex.id,
        position,
      }))
    );

    for (const group of supersetGroups) {
      const { data: templateGroup } = await supabase
        .from("workout_template_superset_groups")
        .insert({ template_id: template.id })
        .select()
        .single();
      if (!templateGroup) continue;
      await supabase.from("workout_template_superset_group_exercises").insert(
        group.exerciseIds.map((exerciseId, position) => ({
          group_id: templateGroup.id,
          exercise_id: exerciseId,
          position,
        }))
      );
    }

    setSavingTemplate(false);
    setShowSaveTemplate(false);
    setTemplateName("");
    setTemplateNotes("");
    setTemplateSaved(true);
  }

  async function openPicker() {
    setShowPicker(true);
    if (catalog.length > 0) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("exercises")
      .select("*, muscle_groups ( name )")
      .order("name");
    setCatalog((data ?? []) as (Exercise & { muscle_groups: { name: string } | null })[]);
  }

  function addExerciseToSession(ex: Exercise) {
    setPlannedExercises((prev) => {
      const existingIndex = prev.findIndex((p) => p.id === ex.id);
      if (existingIndex !== -1) {
        setActiveIndex(existingIndex);
        return prev;
      }
      setActiveIndex(prev.length);
      return [...prev, ex];
    });
    setJustLoggedSet(false);
    setShowPicker(false);
    setPickerQuery("");
  }

  const filteredCatalog = catalog.filter((ex) =>
    ex.name.toLowerCase().includes(pickerQuery.toLowerCase())
  );

  function toggleGroupingSelection(exerciseId: string) {
    setGroupingSelection((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : prev.length < 3
          ? [...prev, exerciseId]
          : prev
    );
  }

  async function confirmSuperset() {
    if (groupingSelection.length < 2 || !userId) return;
    const supabase = createClient();
    const { data: group } = await supabase
      .from("superset_groups")
      .insert({ session_id: sessionId, user_id: userId })
      .select()
      .single();
    if (!group) return;

    await supabase.from("superset_group_exercises").insert(
      groupingSelection.map((exerciseId, position) => ({
        group_id: group.id,
        exercise_id: exerciseId,
        position,
      }))
    );

    setSupersetGroups((prev) => [...prev, { id: group.id, exerciseIds: groupingSelection }]);
    setGroupingMode(false);
    setGroupingSelection([]);
  }

  const prevWeekForExercise = previousWeekSets.filter((s) => s.exercise_id === activeExercise?.id);

  return (
    <main className="min-h-screen px-5 pb-40 pt-6">
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => setShowNotes((v) => !v)}
          className="font-mono text-xs text-chalk-500 underline"
        >
          {notes ? "Edit note" : "Add note"}
        </button>
        {plannedExercises.length > 0 && (
          <button
            onClick={() => setShowSaveTemplate(true)}
            className="font-mono text-xs text-chalk-500 underline"
          >
            Save as template
          </button>
        )}
        <button onClick={requestEndWorkout} className="font-mono text-xs text-copper-400">
          End workout
        </button>
      </div>

      {showEndPrompt && (
        <div className="mt-3 rounded-xl border border-tungsten-500 bg-tungsten-600/10 p-4">
          <p className="text-sm text-tungsten-400">
            You skipped {skippedIds.length === 1 ? "an exercise" : `${skippedIds.length} exercises`}{" "}
            this workout:
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {skippedIds.map((id) => {
              const ex = plannedExercises.find((e) => e.id === id);
              if (!ex) return null;
              return (
                <button
                  key={id}
                  onClick={() => resumeSkippedExercise(id)}
                  className="rounded-lg border border-steel-600 px-3 py-2 text-left text-sm text-chalk-100"
                >
                  Do {ex.name} now
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={finishWorkout}
              className="flex-1 rounded-lg bg-copper-500 px-3 py-2 text-xs font-semibold text-steel-950"
            >
              Finish workout anyway
            </button>
            <button
              onClick={() => setShowEndPrompt(false)}
              className="rounded-lg border border-steel-600 px-3 py-2 text-xs text-chalk-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showNotes && (
        <div className="mt-3 rounded-xl border border-steel-700 bg-steel-900 p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-chalk-500">Notes</p>
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="How it felt, gym conditions, anything to remember…"
            rows={3}
            className="mt-2 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100 outline-none focus:border-copper-500"
          />
          <button
            onClick={() => {
              saveNotes();
              setShowNotes(false);
            }}
            className="mt-2 rounded-lg bg-copper-500 px-3 py-1.5 text-xs font-semibold text-steel-950"
          >
            Save note
          </button>
        </div>
      )}

      {templateSaved && (
        <div className="mt-3 rounded-xl border border-tungsten-500 bg-tungsten-600/10 px-4 py-3">
          <p className="text-sm text-tungsten-400">Saved as a template — find it on Home next time.</p>
        </div>
      )}

      {showSaveTemplate && (
        <div className="mt-3 rounded-xl border border-steel-700 bg-steel-900 p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-chalk-500">
            Name this template
          </p>
          <input
            autoFocus
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. Push Day"
            className="mt-2 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100 outline-none focus:border-copper-500"
          />
          <textarea
            value={templateNotes}
            onChange={(e) => setTemplateNotes(e.target.value)}
            placeholder="Notes for this template (optional)"
            rows={2}
            className="mt-2 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100 outline-none focus:border-copper-500"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={saveAsTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="rounded-lg bg-copper-500 px-3 py-1.5 text-xs font-semibold text-steel-950 disabled:opacity-50"
            >
              {savingTemplate ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setShowSaveTemplate(false);
                setTemplateName("");
                setTemplateNotes("");
              }}
              className="rounded-lg border border-steel-600 px-3 py-1.5 text-xs text-chalk-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {plannedExercises.length > 0 && (
        <div className="relative mt-3">
          <div
            ref={tabStripRef}
            onScroll={updateTabScrollState}
            className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {plannedExercises.map((ex, i) => {
              const inGroup = supersetGroups.some((g) => g.exerciseIds.includes(ex.id));
              const selected = groupingSelection.includes(ex.id);
              return (
                <button
                  key={ex.id}
                  onClick={() => {
                    if (groupingMode) {
                      toggleGroupingSelection(ex.id);
                      return;
                    }
                    setActiveIndex(i);
                    setJustLoggedSet(false);
                  }}
                  className={`shrink-0 snap-start rounded-full px-3 py-1.5 text-xs ${
                    groupingMode
                      ? selected
                        ? "bg-tungsten-500 text-steel-950"
                        : "border border-dashed border-tungsten-500 text-chalk-300"
                      : i === activeIndex
                        ? "bg-copper-500 text-steel-950"
                        : "border border-steel-600 text-chalk-300"
                  }`}
                >
                  {inGroup && !groupingMode && "⚡ "}
                  {skippedIds.includes(ex.id) && "⏭ "}
                  {ex.name}
                </button>
              );
            })}
            <button
              onClick={openPicker}
              className="shrink-0 snap-start rounded-full border border-dashed border-steel-600 px-3 py-1.5 text-xs text-chalk-300"
            >
              + Exercise
            </button>
            <button
              onClick={() => {
                setGroupingMode((v) => !v);
                setGroupingSelection([]);
              }}
              className={`shrink-0 snap-start rounded-full px-3 py-1.5 text-xs ${
                groupingMode
                  ? "bg-tungsten-500 text-steel-950"
                  : "border border-dashed border-steel-600 text-chalk-300"
              }`}
            >
              ⚡ {groupingMode ? "Cancel" : "Superset"}
            </button>
          </div>
          {canScrollLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-steel-950 to-transparent" />
          )}
          {canScrollRight && (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-steel-950 to-transparent" />
          )}
        </div>
      )}

      {groupingMode && (
        <div className="mt-2 flex items-center justify-between rounded-xl border border-tungsten-500 bg-tungsten-600/10 px-4 py-3">
          <p className="text-sm text-tungsten-400">
            {groupingSelection.length < 2
              ? "Pick 2-3 exercises to alternate between"
              : `${groupingSelection.length} selected`}
          </p>
          <button
            onClick={confirmSuperset}
            disabled={groupingSelection.length < 2}
            className="rounded-lg bg-tungsten-500 px-3 py-1.5 text-xs font-semibold text-steel-950 disabled:opacity-40"
          >
            Create superset
          </button>
        </div>
      )}

      {plannedExercises.length === 0 && (
        <button
          onClick={openPicker}
          className="mt-3 w-full rounded-xl border border-dashed border-steel-600 py-3 text-sm text-chalk-300"
        >
          + Add an exercise
        </button>
      )}

      {showPicker && (
        <div className="mt-3 rounded-xl border border-steel-700 bg-steel-900 p-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-widest text-chalk-500">
              Switch or add an exercise
            </p>
            <button onClick={() => setShowPicker(false)} className="text-xs text-chalk-500">
              Close
            </button>
          </div>

          {plannedExercises.length > 1 && (
            <div className="mt-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">
                Today's workout
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {plannedExercises.map((ex, i) =>
                  i === activeIndex ? null : (
                    <button
                      key={ex.id}
                      onClick={() => {
                        setActiveIndex(i);
                        setJustLoggedSet(false);
                        setShowPicker(false);
                      }}
                      className="rounded-full border border-steel-600 px-3 py-1.5 text-xs text-chalk-300"
                    >
                      {ex.name}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-chalk-500">
            Or add from the full catalog
          </p>
          <input
            autoFocus
            placeholder="Search all exercises…"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            className="mt-2 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
          />
          <ul className="mt-2 flex max-h-60 flex-col gap-1 overflow-y-auto">
            {filteredCatalog.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => addExerciseToSession(ex)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-chalk-100 hover:bg-steel-800"
                >
                  <span>{ex.name}</span>
                  <span className="font-mono text-[10px] uppercase text-chalk-500">
                    {ex.muscle_groups?.name}
                  </span>
                </button>
              </li>
            ))}
            {catalog.length === 0 && (
              <p className="px-3 py-2 text-sm text-chalk-500">Loading…</p>
            )}
          </ul>
        </div>
      )}

      {activeExercise && (
        <>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {machinePhotoUrl && (
                <img
                  src={machinePhotoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
              )}
              <h1 className="font-display text-2xl font-extrabold text-chalk-100">
                {activeExercise.name}
              </h1>
            </div>
            <button
              onClick={openPicker}
              className="shrink-0 rounded-lg border border-steel-600 px-3 py-1.5 font-mono text-xs text-chalk-300"
            >
              Switch
            </button>
          </div>

          {activeExercise.is_cardio ? (
            <div className="mt-4 rounded-xl border border-steel-700 bg-steel-900 p-4">
              {cardioEditing ? (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-xs text-chalk-500">Duration (minutes)</span>
                    <input
                      type="number"
                      autoFocus
                      value={cardioDurationMinutes}
                      onChange={(e) => setCardioDurationMinutes(e.target.value)}
                      className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100"
                    />
                  </label>
                  <label className="mt-3 flex flex-col gap-1">
                    <span className="font-mono text-xs text-chalk-500">
                      Calories burned (optional)
                    </span>
                    <input
                      type="number"
                      value={cardioCalories}
                      onChange={(e) => setCardioCalories(e.target.value)}
                      className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100"
                    />
                  </label>
                  <label className="mt-3 flex flex-col gap-1">
                    <span className="font-mono text-xs text-chalk-500">
                      Notes (intensity, incline, etc.)
                    </span>
                    <textarea
                      value={cardioNotes}
                      onChange={(e) => setCardioNotes(e.target.value)}
                      rows={3}
                      placeholder="e.g. Incline 5, resistance 8"
                      className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
                    />
                  </label>
                  <button
                    onClick={saveCardio}
                    disabled={!cardioDurationMinutes}
                    className="mt-3 w-full rounded-xl bg-copper-500 py-3 font-semibold text-steel-950 disabled:opacity-50"
                  >
                    Save
                  </button>
                  {!cardioEntry && plannedExercises.length > 1 && (
                    <button
                      onClick={skipExercise}
                      className="mt-2 w-full rounded-xl border border-dashed border-steel-600 py-3 font-semibold text-chalk-500"
                    >
                      Skip this exercise (machine unavailable)
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-chalk-100">
                    {Math.round((cardioEntry?.duration_seconds ?? 0) / 60)} min
                    {cardioEntry?.calories != null && ` · ${cardioEntry.calories} cal`}
                  </p>
                  {cardioEntry?.notes && (
                    <p className="mt-1 text-sm text-chalk-300">{cardioEntry.notes}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setCardioEditing(true)}
                      className="flex-1 rounded-xl border border-steel-600 py-3 font-semibold text-chalk-300"
                    >
                      Edit
                    </button>
                    {plannedExercises.length > 1 && (
                      <button
                        onClick={goToNextExercise}
                        className="flex-1 rounded-xl bg-copper-500 py-3 font-semibold text-steel-950"
                      >
                        Next exercise
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
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
              onClick={() => updateDraft({ variant: "standard" })}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                variant === "standard"
                  ? "bg-copper-500 text-steel-950"
                  : "border border-steel-600 text-chalk-300"
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => updateDraft({ variant: "tut" })}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                variant === "tut"
                  ? "bg-tungsten-500 text-steel-950"
                  : "border border-steel-600 text-chalk-300"
              }`}
            >
              Time Under Tension
            </button>
          </div>

          {activeExercise.is_unilateral && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => updateDraft({ side: "right" })}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                  side === "right"
                    ? "bg-copper-500 text-steel-950"
                    : "border border-steel-600 text-chalk-300"
                }`}
              >
                Right
              </button>
              <button
                onClick={() => updateDraft({ side: "left" })}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                  side === "left"
                    ? "bg-copper-500 text-steel-950"
                    : "border border-steel-600 text-chalk-300"
                }`}
              >
                Left
              </button>
            </div>
          )}

          {suggestion?.reason === "increase" && (
            <button
              onClick={() => updateDraft({ weight: weight + 5 })}
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

          {justLoggedSet ? (
            <div className="mt-4 rounded-xl border border-steel-700 bg-steel-900 p-4">
              <p className="text-center font-body text-chalk-100">Set logged. What's next?</p>
              <div className="mt-3 flex flex-col gap-2">
                {activeGroup &&
                  (() => {
                    const idx = activeGroup.exerciseIds.indexOf(activeExercise.id);
                    const nextId = activeGroup.exerciseIds[(idx + 1) % activeGroup.exerciseIds.length];
                    const nextExercise = plannedExercises.find((e) => e.id === nextId);
                    if (!nextExercise) return null;
                    const nextTabIndex = plannedExercises.findIndex((e) => e.id === nextId);
                    return (
                      <button
                        onClick={() => {
                          setActiveIndex(nextTabIndex);
                          setJustLoggedSet(false);
                        }}
                        className="w-full rounded-xl bg-tungsten-500 py-3 font-semibold text-steel-950"
                      >
                        Next in superset: {nextExercise.name}
                      </button>
                    );
                  })()}
                <button
                  onClick={() => setJustLoggedSet(false)}
                  className="w-full rounded-xl bg-copper-500 py-3 font-semibold text-steel-950"
                >
                  Add another set
                </button>
                {plannedExercises.length > 1 && (
                  <button
                    onClick={goToNextExercise}
                    className="w-full rounded-xl border border-steel-600 py-3 font-semibold text-chalk-300"
                  >
                    Next exercise
                  </button>
                )}
                {plannedExercises.length > 1 && (
                  <button
                    onClick={skipExercise}
                    className="w-full rounded-xl border border-dashed border-steel-600 py-3 font-semibold text-chalk-500"
                  >
                    Skip this exercise (machine unavailable)
                  </button>
                )}
                <button
                  onClick={() => router.push("/")}
                  className="w-full rounded-xl border border-steel-600 py-3 font-semibold text-chalk-300"
                >
                  Back to Home
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-steel-700 bg-steel-900 p-4">
              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="font-mono text-xs text-chalk-500">Reps</span>
                  <input
                    type="number"
                    value={reps}
                    onChange={(e) => updateDraft({ reps: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100"
                  />
                </label>
                <label className="flex-1">
                  <span className="font-mono text-xs text-chalk-500">Weight ({"lb"})</span>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => updateDraft({ weight: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100"
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                {(["easy", "moderate", "difficult", "failed"] as SetDifficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => updateDraft({ difficulty: d })}
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
          )}
            </>
          )}
        </>
      )}

      {showTimer && activeExercise && (
        <RestTimer
          key={restKey}
          defaultSeconds={restSeconds}
          message={motivationMessage}
          onDismiss={() => setShowTimer(false)}
        />
      )}
    </main>
  );
}

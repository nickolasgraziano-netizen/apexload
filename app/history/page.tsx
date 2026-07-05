"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface HistoryDay {
  sessionId: string;
  name: string | null;
  notes: string | null;
  muscleGroupName: string;
  startedAt: string;
  endedAt: string | null;
  setCount: number;
}

// Unfinished sessions fall off Home automatically (or get removed
// manually), but stay resumable from here for a few days before an
// abandoned session is just treated as history.
const RESUME_WINDOW_DAYS = 3;

function canResume(d: HistoryDay): boolean {
  if (d.endedAt) return false;
  const ageMs = Date.now() - new Date(d.startedAt).getTime();
  return ageMs < RESUME_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

interface ExerciseDetail {
  exerciseName: string;
  sets: {
    reps: number | null;
    weight: number | null;
    variant: string;
    side: string | null;
    durationSeconds: number | null;
    setNotes: string | null;
    calories: number | null;
  }[];
}

export default function HistoryPage() {
  const router = useRouter();
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [notesEditId, setNotesEditId] = useState<string | null>(null);
  const [notesEditValue, setNotesEditValue] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, ExerciseDetail[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  async function refresh() {
    const supabase = createClient();
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, name, notes, started_at, ended_at, muscle_groups ( name ), workout_templates ( name )")
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
        name: s.name,
        notes: s.notes,
        muscleGroupName: s.muscle_groups?.name ?? s.workout_templates?.name ?? "Custom workout",
        startedAt: s.started_at,
        endedAt: s.ended_at,
        setCount: setCounts.get(s.id) ?? 0,
      }))
    );
    setLoading(false);
  }

  async function toggleExpand(sessionId: string) {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    if (detailsCache[sessionId]) return;

    setLoadingDetails(sessionId);
    const supabase = createClient();
    const { data: setRows } = await supabase
      .from("sets")
      .select(
        "actual_reps, weight, training_variant, side, duration_seconds, notes, calories, logged_at, exercises ( name )"
      )
      .eq("session_id", sessionId)
      .order("logged_at");

    const grouped: ExerciseDetail[] = [];
    for (const s of (setRows ?? []) as any[]) {
      const exerciseName = s.exercises?.name ?? "Unknown exercise";
      let entry = grouped.find((g) => g.exerciseName === exerciseName);
      if (!entry) {
        entry = { exerciseName, sets: [] };
        grouped.push(entry);
      }
      entry.sets.push({
        reps: s.actual_reps,
        weight: s.weight,
        variant: s.training_variant,
        side: s.side,
        durationSeconds: s.duration_seconds,
        setNotes: s.notes,
        calories: s.calories,
      });
    }
    setDetailsCache((prev) => ({ ...prev, [sessionId]: grouped }));
    setLoadingDetails(null);
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

  async function saveRename(sessionId: string) {
    const supabase = createClient();
    const trimmed = renameValue.trim();
    await supabase
      .from("sessions")
      .update({ name: trimmed || null })
      .eq("id", sessionId);
    setDays((prev) => prev.map((d) => (d.sessionId === sessionId ? { ...d, name: trimmed || null } : d)));
    setRenamingId(null);
  }

  async function saveNote(sessionId: string) {
    const supabase = createClient();
    const trimmed = notesEditValue.trim();
    await supabase
      .from("sessions")
      .update({ notes: trimmed || null })
      .eq("id", sessionId);
    setDays((prev) =>
      prev.map((d) => (d.sessionId === sessionId ? { ...d, notes: trimmed || null } : d))
    );
    setNotesEditId(null);
  }

  async function repeatWorkout(sessionId: string) {
    setRepeatingId(sessionId);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setRepeatingId(null);
      return;
    }

    // Distinct exercises from that day, in the order they were first logged.
    const { data: setRows } = await supabase
      .from("sets")
      .select("exercise_id, logged_at")
      .eq("session_id", sessionId)
      .order("logged_at");
    const exerciseIds: string[] = [];
    for (const s of setRows ?? []) {
      if (!exerciseIds.includes(s.exercise_id)) exerciseIds.push(s.exercise_id);
    }

    const { data: originalSession } = await supabase
      .from("sessions")
      .select("muscle_group_id")
      .eq("id", sessionId)
      .maybeSingle();

    const { data: originalGroups } = await supabase
      .from("superset_groups")
      .select("id, superset_group_exercises ( exercise_id, position )")
      .eq("session_id", sessionId);

    const { data: newSession } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, muscle_group_id: originalSession?.muscle_group_id ?? null })
      .select()
      .single();

    if (!newSession) {
      setRepeatingId(null);
      return;
    }

    sessionStorage.setItem(`apexload:plan:${newSession.id}`, JSON.stringify(exerciseIds));

    for (const group of originalGroups ?? []) {
      const exercises = ((group as any).superset_group_exercises ?? []).sort(
        (a: any, b: any) => a.position - b.position
      );
      const { data: newGroup } = await supabase
        .from("superset_groups")
        .insert({ session_id: newSession.id, user_id: user.id })
        .select()
        .single();
      if (!newGroup) continue;
      await supabase.from("superset_group_exercises").insert(
        exercises.map((e: any, position: number) => ({
          group_id: newGroup.id,
          exercise_id: e.exercise_id,
          position,
        }))
      );
    }

    router.push(`/workout/${newSession.id}`);
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
              className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
            >
              {renamingId === d.sessionId ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder={d.muscleGroupName}
                    className="flex-1 rounded-lg border border-steel-700 bg-steel-800 px-2 py-1 text-sm text-chalk-100"
                  />
                  <button
                    onClick={() => saveRename(d.sessionId)}
                    className="rounded-lg bg-copper-500 px-3 py-1.5 text-xs font-semibold text-steel-950"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    className="rounded-lg border border-steel-600 px-3 py-1.5 text-xs text-chalk-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleExpand(d.sessionId)}
                    className="flex-1 text-left"
                  >
                    <p className="text-chalk-100">{d.name || d.muscleGroupName}</p>
                    <p className="mt-0.5 font-mono text-xs text-chalk-500">
                      {new Date(d.startedAt).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {d.setCount} {d.setCount === 1 ? "set" : "sets"}
                      {" "}
                      {expandedId === d.sessionId ? "▲" : "▼"}
                    </p>
                  </button>
                  <button
                    onClick={() => {
                      setRenamingId(d.sessionId);
                      setRenameValue(d.name ?? "");
                    }}
                    className="shrink-0 font-mono text-xs text-chalk-500 underline"
                  >
                    Rename
                  </button>
                </div>
              )}

              {expandedId === d.sessionId && (
                <div className="mt-2 flex flex-col gap-3 border-t border-steel-700 pt-2">
                  {notesEditId === d.sessionId ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        autoFocus
                        value={notesEditValue}
                        onChange={(e) => setNotesEditValue(e.target.value)}
                        placeholder="How it felt, gym conditions, anything to remember…"
                        rows={3}
                        className="w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100 outline-none focus:border-copper-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveNote(d.sessionId)}
                          className="rounded-lg bg-copper-500 px-3 py-1.5 text-xs font-semibold text-steel-950"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setNotesEditId(null)}
                          className="rounded-lg border border-steel-600 px-3 py-1.5 text-xs text-chalk-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">
                          Notes
                        </p>
                        <button
                          onClick={() => {
                            setNotesEditId(d.sessionId);
                            setNotesEditValue(d.notes ?? "");
                          }}
                          className="font-mono text-[10px] uppercase text-chalk-500 underline"
                        >
                          {d.notes ? "Edit" : "Add note"}
                        </button>
                      </div>
                      {d.notes && <p className="mt-1 text-sm text-chalk-100">{d.notes}</p>}
                    </div>
                  )}

                  {loadingDetails === d.sessionId ? (
                    <p className="text-xs text-chalk-500">Loading…</p>
                  ) : detailsCache[d.sessionId]?.length ? (
                    detailsCache[d.sessionId].map((entry, i) => (
                      <div key={i}>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">
                          {entry.exerciseName}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {entry.sets.map((s, si) =>
                            s.durationSeconds != null ? (
                              <span
                                key={si}
                                className="rounded-md bg-steel-800 px-2 py-1 font-mono text-xs text-chalk-300"
                              >
                                {Math.round(s.durationSeconds / 60)} min
                                {s.calories != null && ` · ${s.calories} cal`}
                                {s.setNotes && ` · ${s.setNotes}`}
                              </span>
                            ) : (
                              <span
                                key={si}
                                className="rounded-md bg-steel-800 px-2 py-1 font-mono text-xs text-chalk-300"
                              >
                                {s.reps ?? "—"}×{s.weight ?? "—"}
                                {s.side && ` ${s.side === "left" ? "L" : "R"}`}
                                {s.variant === "tut" && (
                                  <span className="ml-1 text-tungsten-400">TUT</span>
                                )}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-chalk-500">No sets logged.</p>
                  )}
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                {canResume(d) && (
                  <Link
                    href={`/workout/${d.sessionId}`}
                    className="rounded-lg bg-tungsten-500 px-3 py-1.5 text-xs font-semibold text-steel-950"
                  >
                    Resume
                  </Link>
                )}
                <Link
                  href={`/workout/edit/${d.sessionId}`}
                  className="rounded-lg border border-steel-600 px-3 py-1.5 text-xs text-chalk-300"
                >
                  Edit
                </Link>
                <button
                  onClick={() => repeatWorkout(d.sessionId)}
                  disabled={repeatingId === d.sessionId}
                  className="rounded-lg bg-copper-500 px-3 py-1.5 text-xs font-semibold text-steel-950 disabled:opacity-50"
                >
                  {repeatingId === d.sessionId ? "Starting…" : "Repeat"}
                </button>
                <button
                  onClick={() => deleteDay(d.sessionId)}
                  disabled={deletingId === d.sessionId}
                  className="rounded-lg border border-copper-600 px-3 py-1.5 text-xs text-copper-400 disabled:opacity-50"
                >
                  {deletingId === d.sessionId ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

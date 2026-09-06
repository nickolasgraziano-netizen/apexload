"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatIntervalSummary } from "@/lib/metrics";
import { autoEndStaleSessions } from "@/lib/sessionLifecycle";
import BruceLeeQuote from "@/components/BruceLeeQuote";
import type { ActivityType, IntervalData } from "@/lib/types";

interface HistoryDay {
  sessionId: string;
  name: string | null;
  notes: string | null;
  muscleGroupName: string;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  autoEndedAt: string | null;
  endReason: string;
  activityType: ActivityType;
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

function toDateInputValue(value: string) {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toTimeInputValue(value: string) {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(11, 16);
}

function combineLocalDateTime(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00`).toISOString();
}

function formatDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "In progress";
  const minutes = Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)
  );
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  return `${hours}h ${mins}m`;
}

function activityLabel(activityType: ActivityType) {
  return activityType[0].toUpperCase() + activityType.slice(1);
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
    distanceMiles: number | null;
    intervalData: IntervalData | null;
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
  const [timeEditId, setTimeEditId] = useState<string | null>(null);
  const [startDateValue, setStartDateValue] = useState("");
  const [startTimeValue, setStartTimeValue] = useState("");
  const [endDateValue, setEndDateValue] = useState("");
  const [endTimeValue, setEndTimeValue] = useState("");
  const [activityEditValue, setActivityEditValue] = useState<ActivityType>("strength");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, ExerciseDetail[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  async function refresh() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await autoEndStaleSessions(supabase);

    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, name, notes, started_at, ended_at, last_activity_at, auto_ended_at, end_reason, activity_type, muscle_groups ( name ), workout_templates ( name )")
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
        lastActivityAt: s.last_activity_at,
        autoEndedAt: s.auto_ended_at,
        endReason: s.end_reason,
        activityType: s.activity_type,
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
        "actual_reps, weight, training_variant, side, duration_seconds, notes, calories, distance_miles, interval_data, logged_at, exercises ( name )"
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
        distanceMiles: s.distance_miles,
        intervalData: s.interval_data,
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

  async function saveTimes(sessionId: string) {
    const startedAt = combineLocalDateTime(startDateValue, startTimeValue);
    const endedAt = endDateValue ? combineLocalDateTime(endDateValue, endTimeValue) : null;
    const supabase = createClient();
    await supabase
      .from("sessions")
      .update({
        started_at: startedAt,
        ended_at: endedAt,
        last_activity_at: endedAt ?? startedAt,
        activity_type: activityEditValue,
        end_reason: "edited",
      })
      .eq("id", sessionId);
    setDays((prev) =>
      prev.map((d) =>
        d.sessionId === sessionId
          ? {
              ...d,
              startedAt,
              endedAt,
              lastActivityAt: endedAt ?? startedAt,
              activityType: activityEditValue,
              endReason: "edited",
            }
          : d
      )
    );
    setTimeEditId(null);
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
      .select("name, muscle_group_id, activity_type, muscle_groups ( name ), workout_templates ( name )")
      .eq("id", sessionId)
      .maybeSingle();

    const { data: originalGroups } = await supabase
      .from("superset_groups")
      .select("id, superset_group_exercises ( exercise_id, position )")
      .eq("session_id", sessionId);

    const { data: newSession } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        muscle_group_id: originalSession?.muscle_group_id ?? null,
        name:
          originalSession?.name ??
          (originalSession as any)?.muscle_groups?.name ??
          (originalSession as any)?.workout_templates?.name ??
          "Workout",
        activity_type: originalSession?.activity_type ?? "strength",
      })
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
    <main className="apex-page">
      <div className="flex items-center justify-between">
        <div>
          <p className="apex-kicker">ApexLoad</p>
          <h1 className="apex-title">History</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/workout/import"
            className="apex-chip"
          >
            + Add past workout
          </Link>
        </div>
      </div>

      <BruceLeeQuote className="mt-4" />

      {loading ? (
        <p className="mt-6 text-sm text-chalk-500">Loading…</p>
      ) : days.length === 0 ? (
        <p className="mt-6 text-sm text-chalk-500">No workouts logged yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {days.map((d) => (
            <li
              key={d.sessionId}
              className="apex-card"
            >
              {renamingId === d.sessionId ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder={d.muscleGroupName}
                    className="apex-input-compact flex-1"
                  />
                  <button
                    onClick={() => saveRename(d.sessionId)}
                    className="rounded-lg bg-copper-500 px-3 py-2 text-xs font-semibold text-steel-950"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    className="apex-secondary-button"
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
                    <p className="font-semibold text-chalk-100">{d.name || d.muscleGroupName}</p>
                    <p className="mt-0.5 font-mono text-xs text-chalk-500">
                      {new Date(d.startedAt).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {activityLabel(d.activityType)}
                      {" · "}
                      {formatDuration(d.startedAt, d.endedAt)}
                      {" · "}
                      {d.setCount} {d.setCount === 1 ? "set" : "sets"}
                      {" "}
                      {expandedId === d.sessionId ? "▲" : "▼"}
                    </p>
                    {d.endReason === "auto_inactivity" && (
                      <p className="mt-1 text-xs text-tungsten-400">
                        Auto-ended at last activity
                      </p>
                    )}
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
                        className="apex-input-compact w-full"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveNote(d.sessionId)}
                          className="rounded-lg bg-copper-500 px-3 py-2 text-xs font-semibold text-steel-950"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setNotesEditId(null)}
                          className="apex-secondary-button"
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

                  {timeEditId === d.sessionId ? (
                    <div className="rounded-lg border border-steel-700 bg-steel-950/40 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">
                        Timing
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="font-mono text-[10px] uppercase text-chalk-500">Start date</span>
                          <input type="date" value={startDateValue} onChange={(e) => setStartDateValue(e.target.value)} className="apex-input-compact" />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-mono text-[10px] uppercase text-chalk-500">Start time</span>
                          <input type="time" value={startTimeValue} onChange={(e) => setStartTimeValue(e.target.value)} className="apex-input-compact" />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-mono text-[10px] uppercase text-chalk-500">End date</span>
                          <input type="date" value={endDateValue} onChange={(e) => setEndDateValue(e.target.value)} className="apex-input-compact" />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-mono text-[10px] uppercase text-chalk-500">End time</span>
                          <input type="time" value={endTimeValue} onChange={(e) => setEndTimeValue(e.target.value)} className="apex-input-compact" />
                        </label>
                      </div>
                      <label className="mt-2 flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase text-chalk-500">Activity type</span>
                        <select value={activityEditValue} onChange={(e) => setActivityEditValue(e.target.value as ActivityType)} className="apex-input-compact">
                          <option value="strength">Strength</option>
                          <option value="cardio">Cardio</option>
                          <option value="mixed">Mixed</option>
                          <option value="mobility">Mobility</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => saveTimes(d.sessionId)} className="rounded-lg bg-copper-500 px-3 py-2 text-xs font-semibold text-steel-950">
                          Save timing
                        </button>
                        <button onClick={() => setTimeEditId(null)} className="apex-secondary-button">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-steel-700 bg-steel-950/40 px-3 py-2">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">
                          Timing
                        </p>
                        <p className="mt-0.5 text-sm text-chalk-100">
                          {formatDuration(d.startedAt, d.endedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setTimeEditId(d.sessionId);
                          setStartDateValue(toDateInputValue(d.startedAt));
                          setStartTimeValue(toTimeInputValue(d.startedAt));
                          setEndDateValue(d.endedAt ? toDateInputValue(d.endedAt) : "");
                          setEndTimeValue(d.endedAt ? toTimeInputValue(d.endedAt) : "");
                          setActivityEditValue(d.activityType);
                        }}
                        className="font-mono text-[10px] uppercase text-chalk-500 underline"
                      >
                        Edit times
                      </button>
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
                                {s.distanceMiles != null && ` · ${s.distanceMiles} mi`}
                                {s.calories != null && ` · ${s.calories} cal`}
                                {s.intervalData && ` · ${formatIntervalSummary(s.intervalData)}`}
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
                    className="rounded-lg bg-tungsten-500 px-3 py-2 text-xs font-semibold text-steel-950"
                  >
                    Resume
                  </Link>
                )}
                <Link
                  href={`/workout/edit/${d.sessionId}`}
                  className="apex-secondary-button"
                >
                  Edit
                </Link>
                <button
                  onClick={() => repeatWorkout(d.sessionId)}
                  disabled={repeatingId === d.sessionId}
                  className="rounded-lg bg-copper-500 px-3 py-2 text-xs font-semibold text-steel-950 disabled:opacity-50"
                >
                  {repeatingId === d.sessionId ? "Starting…" : "Repeat"}
                </button>
                <button
                  onClick={() => deleteDay(d.sessionId)}
                  disabled={deletingId === d.sessionId}
                  className="apex-danger-button disabled:opacity-50"
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

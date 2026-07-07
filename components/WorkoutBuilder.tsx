"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MuscleGroupSelect from "@/components/MuscleGroupSelect";
import type { Exercise, MuscleGroup } from "@/lib/types";

export interface WorkoutBuilderSaveArgs {
  name: string;
  selected: Exercise[];
  pendingGroups: string[][];
}

interface Props {
  title: string;
  subtitle?: string;
  saving: boolean;
  saveLabel: string;
  savingLabel: string;
  onSave: (args: WorkoutBuilderSaveArgs) => void;
  initialName?: string;
  initialSelected?: Exercise[];
  initialPendingGroups?: string[][];
}

// Shared "build a workout from nothing" UI: name it, add exercises one at a
// time (catalog or brand new, cross-muscle-group), flag cardio/superset as
// needed. What happens on save (start it live vs. just save it for later)
// is entirely up to the caller via onSave. Also doubles as an editor when
// initial* props are passed in — same UI, just pre-populated.
export default function WorkoutBuilder({
  title,
  subtitle,
  saving,
  saveLabel,
  savingLabel,
  onSave,
  initialName = "",
  initialSelected = [],
  initialPendingGroups = [],
}: Props) {
  const [name, setName] = useState(initialName);
  const [selected, setSelected] = useState<Exercise[]>(initialSelected);

  const [pendingGroups, setPendingGroups] = useState<string[][]>(initialPendingGroups);
  const [groupingMode, setGroupingMode] = useState(false);
  const [groupingSelection, setGroupingSelection] = useState<string[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [catalog, setCatalog] = useState<(Exercise & { muscle_groups: { name: string } | null })[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerGroupId, setPickerGroupId] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState("");
  const [newIsCardio, setNewIsCardio] = useState(false);
  const [newIsUnilateral, setNewIsUnilateral] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: mg }, { data: ex }, { data: userRes }] = await Promise.all([
        supabase.from("muscle_groups").select("*").order("name"),
        supabase.from("exercises").select("*, muscle_groups ( name )").order("name"),
        supabase.auth.getUser(),
      ]);
      setGroups((mg ?? []) as MuscleGroup[]);
      setCatalog((ex ?? []) as (Exercise & { muscle_groups: { name: string } | null })[]);
      setUserId(userRes?.user?.id ?? null);
    })();
  }, []);

  function removeExercise(exerciseId: string) {
    setSelected((prev) => prev.filter((e) => e.id !== exerciseId));
    setPendingGroups((prev) =>
      prev.map((g) => g.filter((id) => id !== exerciseId)).filter((g) => g.length >= 2)
    );
    setGroupingSelection((prev) => prev.filter((id) => id !== exerciseId));
  }

  function startRename(ex: Exercise) {
    setRenamingId(ex.id);
    setRenameValue(ex.name);
  }

  async function saveRename(exerciseId: string) {
    if (!renameValue.trim()) return;
    setRenaming(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("exercises")
      .update({ name: renameValue.trim() })
      .eq("id", exerciseId);
    if (!error) {
      const trimmed = renameValue.trim();
      setSelected((prev) => prev.map((e) => (e.id === exerciseId ? { ...e, name: trimmed } : e)));
      setCatalog((prev) => prev.map((e) => (e.id === exerciseId ? { ...e, name: trimmed } : e)));
      setRenamingId(null);
    }
    setRenaming(false);
  }

  function addExerciseToSelected(ex: Exercise) {
    setSelected((prev) => (prev.some((e) => e.id === ex.id) ? prev : [...prev, ex]));
    setShowPicker(false);
    setPickerQuery("");
  }

  async function addCustomExercise() {
    if (!newName.trim() || !newGroupId || !userId) return;
    const supabase = createClient();

    const { data: newExercise } = await supabase
      .from("exercises")
      .insert({
        owner_id: userId,
        muscle_group_id: newGroupId,
        name: newName.trim(),
        is_custom: true,
        is_cardio: newIsCardio,
        is_unilateral: newIsUnilateral,
      })
      .select()
      .single();

    if (newExercise) {
      const groupName = groups.find((g) => g.id === newGroupId)?.name ?? null;
      setCatalog((prev) => [
        ...prev,
        { ...(newExercise as Exercise), muscle_groups: { name: groupName ?? "" } },
      ]);
      addExerciseToSelected(newExercise as Exercise);
    }
    setNewName("");
    setNewIsCardio(false);
    setNewIsUnilateral(false);
  }

  function toggleGroupingSelection(exerciseId: string) {
    setGroupingSelection((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : prev.length < 3
          ? [...prev, exerciseId]
          : prev
    );
  }

  function confirmSuperset() {
    if (groupingSelection.length < 2) return;
    setPendingGroups((prev) => [...prev, groupingSelection]);
    setGroupingMode(false);
    setGroupingSelection([]);
  }

  function removePendingGroup(index: number) {
    setPendingGroups((prev) => prev.filter((_, i) => i !== index));
  }

  const filteredCatalog = catalog.filter(
    (ex) =>
      ex.name.toLowerCase().includes(pickerQuery.toLowerCase()) &&
      (!pickerGroupId || ex.muscle_group_id === pickerGroupId)
  );

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <p className="font-mono text-xs uppercase tracking-widest text-copper-500">Set up</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-chalk-500">{subtitle}</p>}

      <label className="mt-6 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          Name this workout
        </span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day"
          className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
        />
      </label>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
            Exercises
          </h2>
          {selected.length > 1 && (
            <button
              onClick={() => {
                setGroupingMode((v) => !v);
                setGroupingSelection([]);
              }}
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${
                groupingMode
                  ? "bg-tungsten-500 text-steel-950"
                  : "border border-dashed border-steel-600 text-chalk-300"
              }`}
            >
              ⚡ {groupingMode ? "Cancel" : "Superset"}
            </button>
          )}
        </div>

        {selected.length === 0 && (
          <p className="mt-2 text-sm text-chalk-500">
            No exercises yet — add your first one below.
          </p>
        )}

        <ul className="mt-2 flex flex-col gap-2">
          {selected.map((ex) => {
            const groupIndex = pendingGroups.findIndex((g) => g.includes(ex.id));
            const selectedForGroup = groupingSelection.includes(ex.id);

            if (renamingId === ex.id) {
              return (
                <li key={ex.id} className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100"
                  />
                  <button
                    onClick={() => saveRename(ex.id)}
                    disabled={renaming || !renameValue.trim()}
                    className="shrink-0 rounded-xl bg-copper-500 px-3 py-3 text-xs font-semibold text-steel-950 disabled:opacity-50"
                  >
                    {renaming ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    className="shrink-0 rounded-xl border border-steel-600 px-3 py-3 text-xs text-chalk-300"
                  >
                    Cancel
                  </button>
                </li>
              );
            }

            return (
              <li key={ex.id} className="flex items-center gap-2">
                <button
                  disabled={!groupingMode}
                  onClick={() => toggleGroupingSelection(ex.id)}
                  className={`flex flex-1 items-center justify-between rounded-xl px-4 py-3 text-left text-chalk-100 ${
                    groupingMode
                      ? selectedForGroup
                        ? "bg-tungsten-500 text-steel-950"
                        : "border border-dashed border-tungsten-500"
                      : "border border-steel-700 bg-steel-900"
                  }`}
                >
                  <span>
                    {groupIndex !== -1 && !groupingMode && "⚡ "}
                    {ex.name}
                    {ex.is_cardio && (
                      <span className="ml-2 font-mono text-[10px] uppercase text-tungsten-400">
                        Cardio
                      </span>
                    )}
                  </span>
                  {groupIndex !== -1 && !groupingMode && (
                    <span className="font-mono text-[10px] uppercase text-tungsten-400">
                      Superset {groupIndex + 1}
                    </span>
                  )}
                </button>
                {!groupingMode && ex.owner_id === userId && (
                  <button
                    onClick={() => startRename(ex)}
                    className="shrink-0 rounded-xl border border-steel-600 px-3 py-3 text-chalk-300"
                  >
                    ✎
                  </button>
                )}
                {!groupingMode && (
                  <button
                    onClick={() => removeExercise(ex.id)}
                    className="shrink-0 rounded-xl border border-copper-600 px-3 py-3 text-copper-400"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {!groupingMode && (
          <button
            onClick={() => setShowPicker(true)}
            className="mt-2 w-full rounded-xl border border-dashed border-steel-600 py-3 text-sm text-chalk-300"
          >
            + Add exercise
          </button>
        )}

        {showPicker && (
          <div className="mt-3 rounded-xl border border-steel-700 bg-steel-900 p-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-widest text-chalk-500">
                Add exercise
              </p>
              <button onClick={() => setShowPicker(false)} className="text-xs text-chalk-500">
                Close
              </button>
            </div>
            <input
              autoFocus
              placeholder="Search by name…"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              className="mt-2 w-full rounded-lg border border-steel-500 bg-steel-800 px-3 py-2 text-sm text-chalk-100 outline-none placeholder:text-chalk-500 focus:border-copper-500"
            />
            <select
              value={pickerGroupId}
              onChange={(e) => setPickerGroupId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
            >
              <option value="">All muscle groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <ul className="mt-2 flex max-h-60 flex-col gap-1 overflow-y-auto">
              {filteredCatalog.map((ex) => (
                <li key={ex.id}>
                  <button
                    onClick={() => addExerciseToSelected(ex)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-chalk-100 hover:bg-steel-800"
                  >
                    <span>
                      {ex.name}
                      {ex.is_cardio && (
                        <span className="ml-2 font-mono text-[10px] uppercase text-tungsten-400">
                          Cardio
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-chalk-500">
                      {ex.muscle_groups?.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-3 border-t border-steel-700 pt-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">
                Can't find it? Add a custom exercise
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <input
                  placeholder="Exercise name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
                />
                <MuscleGroupSelect
                  groups={groups}
                  value={newGroupId}
                  onChange={setNewGroupId}
                  onGroupCreated={(g) => setGroups((prev) => [...prev, g])}
                  userId={userId}
                  className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
                />
                <label className="flex items-center gap-2 text-sm text-chalk-300">
                  <input
                    type="checkbox"
                    checked={newIsUnilateral}
                    onChange={(e) => setNewIsUnilateral(e.target.checked)}
                  />
                  Unilateral (train each side separately)
                </label>
                <label className="flex items-center gap-2 text-sm text-chalk-300">
                  <input
                    type="checkbox"
                    checked={newIsCardio}
                    onChange={(e) => setNewIsCardio(e.target.checked)}
                  />
                  Cardio (logged by duration, not sets)
                </label>
                <button
                  onClick={addCustomExercise}
                  className="rounded-lg bg-copper-500 py-2 text-sm font-semibold text-steel-950"
                >
                  Add and use
                </button>
              </div>
            </div>
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

        {pendingGroups.length > 0 && !groupingMode && (
          <div className="mt-3 flex flex-col gap-1">
            {pendingGroups.map((group, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-chalk-500">
                <span>
                  Superset {i + 1}:{" "}
                  {group
                    .map((id) => selected.find((e) => e.id === id)?.name)
                    .filter(Boolean)
                    .join(" ↔ ")}
                </span>
                <button onClick={() => removePendingGroup(i)} className="text-copper-400">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        onClick={() => onSave({ name: name.trim(), selected, pendingGroups })}
        disabled={saving || !name.trim() || selected.length === 0}
        className="mt-8 w-full rounded-xl bg-copper-500 px-4 py-4 text-center font-body font-semibold text-steel-950 active:bg-copper-600 disabled:opacity-50"
      >
        {saving ? savingLabel : saveLabel}
      </button>
    </main>
  );
}

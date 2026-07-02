"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, MuscleGroup } from "@/lib/types";

export default function ExerciseCatalogPage() {
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState("");
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  async function refresh() {
    const supabase = createClient();
    const { data: mg } = await supabase.from("muscle_groups").select("*").order("name");
    setGroups((mg ?? []) as MuscleGroup[]);
    const { data: ex } = await supabase.from("exercises").select("*").order("name");
    setExercises((ex ?? []) as Exercise[]);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addCustomExercise() {
    if (!newName.trim() || !newGroupId) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("exercises").insert({
      owner_id: user.id,
      muscle_group_id: newGroupId,
      name: newName.trim(),
      is_custom: true,
    });
    setNewName("");
    refresh();
  }

  async function uploadMachinePhoto(exerciseId: string, file: File) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setUploadingFor(exerciseId);
    const path = `${user.id}/${exerciseId}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("machine-photos")
      .upload(path, file);

    if (!uploadError) {
      await supabase.from("machine_photos").insert({
        user_id: user.id,
        exercise_id: exerciseId,
        storage_path: path,
      });
    }
    setUploadingFor(null);
  }

  const filtered = exercises.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <p className="font-mono text-xs uppercase tracking-widest text-copper-500">Catalog</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">Exercises</h1>

      <input
        placeholder="Search exercises…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-5 w-full rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
      />

      <section className="mt-6 rounded-2xl border border-steel-700 bg-steel-900 p-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          Add custom exercise
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          <input
            placeholder="Exercise name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100"
          />
          <select
            value={newGroupId}
            onChange={(e) => setNewGroupId(e.target.value)}
            className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100"
          >
            <option value="">Muscle group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            onClick={addCustomExercise}
            className="rounded-lg bg-copper-500 py-2 text-sm font-semibold text-steel-950"
          >
            Add
          </button>
        </div>
      </section>

      <ul className="mt-6 flex flex-col gap-2">
        {filtered.map((ex) => (
          <li
            key={ex.id}
            className="flex items-center justify-between rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
          >
            <div>
              <p className="text-chalk-100">{ex.name}</p>
              {ex.is_custom && (
                <span className="font-mono text-[10px] uppercase text-tungsten-400">Custom</span>
              )}
            </div>
            <label className="cursor-pointer rounded-lg border border-steel-600 px-3 py-1.5 text-xs text-chalk-300">
              {uploadingFor === ex.id ? "Uploading…" : "📷 Photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMachinePhoto(ex.id, file);
                }}
              />
            </label>
          </li>
        ))}
      </ul>
    </main>
  );
}

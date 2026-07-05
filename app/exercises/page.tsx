"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MuscleGroupSelect from "@/components/MuscleGroupSelect";
import type { Exercise, MuscleGroup } from "@/lib/types";

export default function ExerciseCatalogPage() {
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState("");
  const [newIsUnilateral, setNewIsUnilateral] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);

  async function refresh() {
    const supabase = createClient();
    const { data: mg } = await supabase.from("muscle_groups").select("*").order("name");
    setGroups((mg ?? []) as MuscleGroup[]);
    const { data: ex } = await supabase.from("exercises").select("*").order("name");
    setExercises((ex ?? []) as Exercise[]);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: photos } = await supabase
      .from("machine_photos")
      .select("exercise_id, storage_path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Most recent photo per exercise.
    const latestPathByExercise = new Map<string, string>();
    for (const p of photos ?? []) {
      if (!latestPathByExercise.has(p.exercise_id)) {
        latestPathByExercise.set(p.exercise_id, p.storage_path);
      }
    }
    if (latestPathByExercise.size === 0) return;

    const { data: signed } = await supabase.storage
      .from("machine-photos")
      .createSignedUrls([...latestPathByExercise.values()], 3600);

    const pathToUrl = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    const urls: Record<string, string> = {};
    for (const [exerciseId, path] of latestPathByExercise) {
      const url = pathToUrl.get(path);
      if (url) urls[exerciseId] = url;
    }
    setPhotoUrls(urls);
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
      is_unilateral: newIsUnilateral,
    });
    setNewName("");
    setNewIsUnilateral(false);
    refresh();
  }

  async function toggleUnilateral(ex: Exercise) {
    const supabase = createClient();
    await supabase.from("exercises").update({ is_unilateral: !ex.is_unilateral }).eq("id", ex.id);
    setExercises((prev) =>
      prev.map((e) => (e.id === ex.id ? { ...e, is_unilateral: !e.is_unilateral } : e))
    );
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
      await refresh();
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
          <MuscleGroupSelect
            groups={groups}
            value={newGroupId}
            onChange={setNewGroupId}
            onGroupCreated={(g) => setGroups((prev) => [...prev, g])}
            userId={userId}
            className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100"
          />
          <label className="flex items-center gap-2 text-sm text-chalk-300">
            <input
              type="checkbox"
              checked={newIsUnilateral}
              onChange={(e) => setNewIsUnilateral(e.target.checked)}
            />
            Unilateral (train each side separately)
          </label>
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
            <div className="flex items-center gap-3">
              {photoUrls[ex.id] && (
                <img
                  src={photoUrls[ex.id]}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              )}
              <div>
                <p className="text-chalk-100">{ex.name}</p>
                <div className="flex flex-wrap gap-2">
                  {ex.is_custom && (
                    <span className="font-mono text-[10px] uppercase text-tungsten-400">Custom</span>
                  )}
                  {ex.is_unilateral && (
                    <span className="font-mono text-[10px] uppercase text-copper-400">
                      Per side
                    </span>
                  )}
                  {ex.owner_id === userId && (
                    <button
                      onClick={() => toggleUnilateral(ex)}
                      className="font-mono text-[10px] uppercase text-chalk-500 underline"
                    >
                      {ex.is_unilateral ? "Make bilateral" : "Make unilateral"}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <label className="cursor-pointer rounded-lg border border-steel-600 px-3 py-1.5 text-xs text-chalk-300">
              {uploadingFor === ex.id ? "Uploading…" : "📷 Photo"}
              <input
                type="file"
                accept="image/*"
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

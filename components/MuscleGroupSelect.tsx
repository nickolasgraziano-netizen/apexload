"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MuscleGroup } from "@/lib/types";

const NEW_GROUP_VALUE = "__new__";

export default function MuscleGroupSelect({
  groups,
  value,
  onChange,
  onGroupCreated,
  userId,
  className,
}: {
  groups: MuscleGroup[];
  value: string;
  onChange: (groupId: string) => void;
  onGroupCreated: (group: MuscleGroup) => void;
  userId: string | null;
  className?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGroup() {
    if (!newName.trim() || !userId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const trimmed = newName.trim();
    const { data, error: insertError } = await supabase
      .from("muscle_groups")
      .insert({ name: trimmed, owner_id: userId, is_global: false })
      .select()
      .single();

    if (data) {
      onGroupCreated(data as MuscleGroup);
      onChange(data.id);
      setSaving(false);
      setCreating(false);
      setNewName("");
      return;
    }

    // Unique-violation on a name you already have (e.g. a retried click) —
    // just use the existing one instead of erroring on something that's
    // effectively already done.
    if (insertError?.code === "23505") {
      const { data: existing } = await supabase
        .from("muscle_groups")
        .select("*")
        .eq("owner_id", userId)
        .ilike("name", trimmed)
        .maybeSingle();
      if (existing) {
        onGroupCreated(existing as MuscleGroup);
        onChange(existing.id);
        setSaving(false);
        setCreating(false);
        setNewName("");
        return;
      }
    }

    setSaving(false);
    setError("Couldn't create that group. Try a different name.");
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Cardio"
            className={className}
          />
          <button
            onClick={createGroup}
            disabled={saving || !newName.trim()}
            className="shrink-0 rounded-lg bg-copper-500 px-3 py-2 text-xs font-semibold text-steel-950 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add"}
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName("");
              setError(null);
            }}
            className="shrink-0 rounded-lg border border-steel-600 px-3 py-2 text-xs text-chalk-300"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-copper-400">{error}</p>}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === NEW_GROUP_VALUE) {
          setCreating(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={className}
    >
      <option value="">Muscle group…</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
      <option value={NEW_GROUP_VALUE}>+ New group…</option>
    </select>
  );
}

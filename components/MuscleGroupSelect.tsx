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

  async function createGroup() {
    if (!newName.trim() || !userId) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("muscle_groups")
      .insert({ name: newName.trim(), owner_id: userId, is_global: false })
      .select()
      .single();
    setSaving(false);
    if (data) {
      onGroupCreated(data as MuscleGroup);
      onChange(data.id);
      setCreating(false);
      setNewName("");
    }
  }

  if (creating) {
    return (
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
          }}
          className="shrink-0 rounded-lg border border-steel-600 px-3 py-2 text-xs text-chalk-300"
        >
          Cancel
        </button>
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

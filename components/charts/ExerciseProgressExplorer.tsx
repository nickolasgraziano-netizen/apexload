"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";
import type { Exercise } from "@/lib/types";

interface ProgressPoint {
  loggedAt: string;
  weight: number;
  label: string;
}

export default function ExerciseProgressExplorer({ exercises }: { exercises: Exercise[] }) {
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? "");
  const [points, setPoints] = useState<ProgressPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [personalBest, setPersonalBest] = useState<number | null>(null);

  useEffect(() => {
    if (!exerciseId) return;
    setLoading(true);
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("sets")
        .select("weight, logged_at")
        .eq("exercise_id", exerciseId)
        .not("weight", "is", null)
        .order("logged_at", { ascending: true });

      const rows = (data ?? []) as { weight: number; logged_at: string }[];
      setPoints(
        rows.map((r) => ({
          loggedAt: r.logged_at,
          weight: r.weight,
          label: new Date(r.logged_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
        }))
      );
      setPersonalBest(rows.length > 0 ? Math.max(...rows.map((r) => r.weight)) : null);
      setLoading(false);
    })();
  }, [exerciseId]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <select
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          className="w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
        {personalBest != null && (
          <span className="shrink-0 font-mono text-xs uppercase text-tungsten-400">
            PR {personalBest} lb
          </span>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-chalk-500">Loading…</p>
      ) : points.length < 2 ? (
        <p className="mt-4 text-sm text-chalk-500">Not enough logged sets yet for a trend.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180} className="mt-3">
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262B33" vertical={false} />
            <XAxis dataKey="label" stroke="#5B636D" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              stroke="#5B636D"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={36}
              domain={["dataMin - 5", "dataMax + 5"]}
            />
            <Tooltip
              contentStyle={{
                background: "#1B1F26",
                border: "1px solid #262B33",
                borderRadius: 8,
                fontSize: 12,
                color: "#F5F3EE",
              }}
              formatter={(value) => [`${value} lb`, "Weight"]}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#3FB8A8"
              strokeWidth={2}
              dot={{ r: 3, fill: "#3FB8A8" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

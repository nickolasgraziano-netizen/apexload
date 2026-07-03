"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyMuscleVolume, DifficultyBreakdown, VariantSplit, WeeklySessionCount } from "@/lib/metrics";

const AXIS_COLOR = "#5B636D"; // steel-500
const GRID_COLOR = "#262B33"; // steel-700
const TOOLTIP_STYLE = {
  background: "#1B1F26", // steel-800
  border: "1px solid #262B33",
  borderRadius: 8,
  fontSize: 12,
  color: "#F5F3EE",
};

const MUSCLE_GROUP_COLORS = ["#FF7A45", "#3FB8A8", "#D8D4CA", "#889099", "#B84A20"];

function shortWeekLabel(weekStart: string) {
  const d = new Date(`${weekStart}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function VolumeChart({
  data,
  muscleGroups,
}: {
  data: WeeklyMuscleVolume[];
  muscleGroups: { id: string; name: string }[];
}) {
  const weeks = [...new Set(data.map((d) => d.weekStart))].sort();
  const rows = weeks.map((weekStart) => {
    const row: Record<string, number | string> = { weekStart, label: shortWeekLabel(weekStart) };
    for (const mg of muscleGroups) {
      const match = data.find((d) => d.weekStart === weekStart && d.muscleGroupId === mg.id);
      row[mg.id] = match?.volume ?? 0;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        {muscleGroups.map((mg, i) => (
          <Bar
            key={mg.id}
            dataKey={mg.id}
            name={mg.name}
            stackId="volume"
            fill={MUSCLE_GROUP_COLORS[i % MUSCLE_GROUP_COLORS.length]}
            radius={i === muscleGroups.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#3FB8A8",
  moderate: "#D8D4CA",
  difficult: "#FF7A45",
  failed: "#B84A20",
};

export function DifficultyChart({ data }: { data: DifficultyBreakdown[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="difficulty"
          stroke={AXIS_COLOR}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v: string) => v[0].toUpperCase() + v.slice(1)}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.difficulty} fill={DIFFICULTY_COLORS[d.difficulty]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const VARIANT_COLORS: Record<string, string> = { standard: "#FF7A45", tut: "#3FB8A8" };
const VARIANT_LABELS: Record<string, string> = { standard: "Standard", tut: "Time Under Tension" };

export function VariantChart({ data }: { data: VariantSplit[] }) {
  return (
    <ResponsiveContainer width="100%" height={90}>
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="variant"
          stroke={AXIS_COLOR}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={100}
          tickFormatter={(v: string) => VARIANT_LABELS[v] ?? v}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.variant} fill={VARIANT_COLORS[d.variant]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SessionsPerWeekChart({ data }: { data: WeeklySessionCount[] }) {
  const rows = data.map((d) => ({ ...d, label: shortWeekLabel(d.weekStart) }));
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke={AXIS_COLOR}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={24}
          allowDecimals={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#FF7A45"
          strokeWidth={2}
          dot={{ r: 3, fill: "#FF7A45" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

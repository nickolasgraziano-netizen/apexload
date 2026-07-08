"use client";

import type { OrderedMuscleGroup } from "@/lib/types";

interface Props {
  groups: OrderedMuscleGroup[]; // sorted by sort_order
  predictedGroupId: string;
}

/**
 * Circular "loading plate" motif — the five muscle groups sit as segments
 * around a plate, echoing the literal shape of the equipment the app
 * tracks. The predicted segment lights up tracksuit-yellow; the rest sit
 * quiet in steel, so the eye lands on "what's next" immediately.
 */
export default function RotationWheel({ groups, predictedGroupId }: Props) {
  const size = 220;
  const center = size / 2;
  const radius = 92;
  const segmentAngle = 360 / groups.length;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius + 14}
          fill="rgb(var(--color-steel-900))"
          stroke="rgb(var(--color-steel-700))"
          strokeWidth={1}
        />
        {groups.map((g, i) => {
          const startAngle = i * segmentAngle - 90;
          const isPredicted = g.id === predictedGroupId;
          const angleRad = (startAngle + segmentAngle / 2) * (Math.PI / 180);
          const x = center + radius * Math.cos(angleRad);
          const y = center + radius * Math.sin(angleRad);
          return (
            <g key={g.id}>
              <circle
                cx={x}
                cy={y}
                r={isPredicted ? 26 : 20}
                fill={isPredicted ? "rgb(var(--color-copper-500))" : "rgb(var(--color-steel-800))"}
                stroke={isPredicted ? "rgb(var(--color-copper-400))" : "rgb(var(--color-steel-600))"}
                strokeWidth={isPredicted ? 2 : 1}
                className="transition-all duration-500"
              />
            </g>
          );
        })}
        <circle
          cx={center}
          cy={center}
          r={38}
          fill="rgb(var(--color-steel-950))"
          stroke="rgb(var(--color-steel-600))"
          strokeWidth={1}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">
          Next
        </span>
      </div>
    </div>
  );
}

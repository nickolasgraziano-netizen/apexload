"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface NextUpItem {
  muscleGroupId: string;
  name: string;
  daysSinceLastTrained: number | null;
}

function freshnessLabel(daysSinceLastTrained: number | null) {
  if (daysSinceLastTrained == null) return "No recent sets logged";
  if (daysSinceLastTrained === 0) return "Trained today";
  return `Last trained ${daysSinceLastTrained}d ago`;
}

function chipLabel(daysSinceLastTrained: number | null) {
  return daysSinceLastTrained == null ? "never" : `${daysSinceLastTrained}d`;
}

export default function NextUpSelector({ items }: { items: NextUpItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.muscleGroupId ?? "");
  const selected = items.find((item) => item.muscleGroupId === selectedId) ?? items[0];
  const alternates = items.filter((item) => item.muscleGroupId !== selected.muscleGroupId);

  const startHref = useMemo(() => {
    const params = new URLSearchParams({
      muscleGroupId: selected.muscleGroupId,
      name: selected.name,
    });
    return `/workout/build?${params.toString()}`;
  }, [selected]);

  function rotateSelection() {
    const currentIndex = items.findIndex((item) => item.muscleGroupId === selected.muscleGroupId);
    const next = items[(currentIndex + 1) % items.length];
    setSelectedId(next.muscleGroupId);
  }

  if (!selected) return null;

  return (
    <section className="apex-section">
      <h3 className="apex-section-title text-tungsten-400">Next up</h3>

      <div className="apex-card-live mt-2 flex items-center justify-between gap-3 border-copper-600/70 bg-copper-950/30 backdrop-blur-md">
        <button
          type="button"
          onClick={rotateSelection}
          className="min-w-0 flex-1 text-left"
          aria-label={`Current suggestion: ${selected.name}. Tap to rotate suggestions.`}
        >
          <p className="truncate font-display text-2xl font-extrabold uppercase leading-none text-chalk-100">
            {selected.name}
          </p>
          <p className="mt-1 font-mono text-xs text-chalk-500">
            {freshnessLabel(selected.daysSinceLastTrained)}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {items.length > 1 && (
            <button
              type="button"
              onClick={rotateSelection}
              aria-label="Pick the next freshest muscle group"
              className="rounded-lg border border-copper-500/70 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-copper-400 active:bg-copper-500 active:text-steel-950"
            >
              Swap
            </button>
          )}
          <Link
            href={startHref}
            className="rounded-lg bg-copper-500 px-3 py-2 text-xs font-semibold text-steel-950 active:bg-copper-600"
          >
            Start
          </Link>
        </div>
      </div>

      {alternates.length > 0 && (
        <div className="relative mt-2">
          <div className="flex gap-2 overflow-x-auto pb-1 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {alternates.slice(0, 5).map((item) => (
              <button
                key={item.muscleGroupId}
                type="button"
                onClick={() => setSelectedId(item.muscleGroupId)}
                className="apex-chip shrink-0 active:border-copper-500 active:text-copper-400"
              >
                {item.name} · {chipLabel(item.daysSinceLastTrained)}
              </button>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-steel-950 to-transparent"
          />
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

// Add a new theme by adding a [data-theme="..."] block in globals.css and
// an entry here — the switcher and the storage/attribute wiring need no
// other changes.
const THEMES = [
  { id: "dragon", label: "Dragon & Chalk", swatch: "#FFD400" },
  { id: "iron-ember", label: "Iron & Ember", swatch: "#FF3B1F" },
] as const;

const STORAGE_KEY = "apexload:theme";

function applyTheme(id: string) {
  if (id === "dragon") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = id;
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-steel-950").trim();
    if (bg) meta.setAttribute("content", `rgb(${bg.replace(/\s+/g, ",")})`);
  }
}

// Floating control, present on every page, that lets you preview
// alternate color themes live (no rebuild/redeploy) — picks are saved to
// localStorage so they stick across navigation and reloads.
export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("dragon");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? "dragon";
    setCurrent(stored);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(id: string) {
    setCurrent(id);
    localStorage.setItem(STORAGE_KEY, id);
    applyTheme(id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 flex flex-col gap-1 rounded-xl border border-steel-600/60 bg-steel-900/95 p-2 backdrop-blur-md">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
                current === t.id ? "bg-steel-800 text-chalk-100" : "text-chalk-300"
              }`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: t.swatch }}
              />
              {t.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change theme"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-steel-600/60 bg-steel-900/90 text-lg backdrop-blur-md"
      >
        🎨
      </button>
    </div>
  );
}

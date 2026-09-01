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

// Bottom-nav control that lets you preview alternate color themes live
// (no rebuild/redeploy) — picks are saved to localStorage so they stick
// across navigation and reloads.
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
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full right-0 mb-3 w-44 rounded-lg border border-steel-600/70 bg-steel-900/95 p-2 shadow-2xl shadow-steel-950/70 backdrop-blur-md">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
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
        aria-expanded={open}
        className={`apex-bottom-link w-full ${open ? "apex-bottom-link-active" : ""}`}
      >
        <span aria-hidden="true">◐</span>
        Theme
      </button>
    </div>
  );
}

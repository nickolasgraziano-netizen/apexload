import type { Config } from "tailwindcss";

// Color tokens are wired to CSS custom properties (defined in globals.css)
// instead of static hex, so a `data-theme` attribute on <html> can swap the
// whole palette at runtime — see components/ThemeSwitcher.tsx. Token names
// (steel/chalk/copper/tungsten) and their semantic roles stay constant
// across themes; only the values change per theme.
function themeColor(variableName: string) {
  return ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `rgb(var(${variableName}))`
      : `rgb(var(${variableName}) / ${opacityValue})`;
}

// Tailwind supports opacity-aware color functions like this at runtime, but
// its own Config type doesn't model them — cast at the boundary rather than
// losing type-checking for the rest of the file.
const themedColors = {
  steel: {
    950: themeColor("--color-steel-950"),
    900: themeColor("--color-steel-900"),
    800: themeColor("--color-steel-800"),
    700: themeColor("--color-steel-700"),
    600: themeColor("--color-steel-600"),
    500: themeColor("--color-steel-500"),
    400: themeColor("--color-steel-400"),
  },
  chalk: {
    100: themeColor("--color-chalk-100"),
    300: themeColor("--color-chalk-300"),
    500: themeColor("--color-chalk-500"),
  },
  // Primary accent — standard sets / main CTAs.
  copper: {
    400: themeColor("--color-copper-400"),
    500: themeColor("--color-copper-500"),
    600: themeColor("--color-copper-600"),
    700: themeColor("--color-copper-700"),
  },
  // Secondary accent — TUT / cardio / supersets, visually distinct from
  // the primary accent so training modes never blur together.
  tungsten: {
    400: themeColor("--color-tungsten-400"),
    500: themeColor("--color-tungsten-500"),
    600: themeColor("--color-tungsten-600"),
  },
} as unknown as Record<string, Record<string, string>>;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: themedColors,
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        plate: "50%",
      },
    },
  },
  plugins: [],
};

export default config;

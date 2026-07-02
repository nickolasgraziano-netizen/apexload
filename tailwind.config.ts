import type { Config } from "tailwindcss";

// ApexLoad design tokens — "Iron & Chalk"
// Background: oxidized steel near-black. Accent: heated-copper for primary
// actions/standard sets. Cool tungsten-teal for TUT (time under tension) —
// visually distinct so the two training modes never blur together.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        steel: {
          950: "#0B0D10",
          900: "#13161B",
          800: "#1B1F26",
          700: "#262B33",
          600: "#3A4149",
          500: "#5B636D",
          400: "#889099",
        },
        chalk: {
          100: "#F5F3EE",
          300: "#D8D4CA",
          500: "#A9A497",
        },
        copper: {
          400: "#FF9868",
          500: "#FF7A45",
          600: "#E0602E",
          700: "#B84A20",
        },
        tungsten: {
          400: "#6FD6C8",
          500: "#3FB8A8",
          600: "#2C9384",
        },
      },
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

import type { Config } from "tailwindcss";

// ApexLoad design tokens — "Dragon & Chalk" (Bruce Lee inspired)
// Background: near-black, like the stripe on his Game of Death tracksuit.
// Accent: bold tracksuit-yellow for primary actions/standard sets.
// Vermilion (Chinese lacquer red) for TUT (time under tension) —
// visually distinct so the two training modes never blur together.
// Token names (copper/tungsten) are unchanged from the prior theme —
// only the values moved — so no className changes were needed anywhere.
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
        // Bruce Lee tracksuit yellow.
        copper: {
          400: "#FFE066",
          500: "#FFD400",
          600: "#E6BE00",
          700: "#C9A400",
        },
        // Vermilion — classic Chinese lacquer red.
        tungsten: {
          400: "#FF6B57",
          500: "#E34234",
          600: "#C4341F",
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

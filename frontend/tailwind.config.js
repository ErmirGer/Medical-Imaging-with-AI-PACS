/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // deep near-black navy canvas + a Linear-style surface ladder
        ink: "#070b14", // page canvas (deepest)
        surface: "#0d1320", // level 1 — cards
        panel: "#111a2b", // level 2 — lifted / secondary
        "panel-2": "#162236", // level 3 — hovered / nested
        edge: "#1e2840", // hairline border
        "edge-strong": "#2b3a58", // stronger hairline / focus
        high: "#fb6a6a",
        medium: "#fbbf4d",
        low: "#34d399",
        accent: "#19c8b6", // medical teal
        accent2: "#34e0d0", // cyan-teal (gradients)
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #14b8a6 0%, #34e0d0 100%)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.3), 0 8px 24px -12px rgba(0,0,0,0.5)",
        "accent-glow": "0 8px 30px -10px rgba(25,200,182,0.35)",
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

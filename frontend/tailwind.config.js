/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a1326",
        surface: "#0f1b33",
        panel: "#16243f",
        edge: "#2a3b5e",
        high: "#ef4444",
        medium: "#f59e0b",
        low: "#10b981",
        accent: "#14b8a6", // medical teal
        accent2: "#22d3ee", // cyan (gradients)
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #14b8a6 0%, #22d3ee 100%)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

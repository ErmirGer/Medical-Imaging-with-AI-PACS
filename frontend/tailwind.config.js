/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        surface: "#0f1729",
        panel: "#16213a",
        edge: "#24314f",
        high: "#ef4444",
        medium: "#f59e0b",
        low: "#10b981",
        accent: "#38bdf8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

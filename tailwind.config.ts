import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0a08",
        ink: "#f7efe1",
        muted: "#a59682",
        accent: "#e8b14a",
        accent2: "#c0392b",
      },
      fontFamily: {
        display: ['"Noto Serif JP"', "ui-serif", "Georgia", "serif"],
        sans: ['"Noto Sans JP"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.995)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        kenBurns: {
          "0%": { transform: "scale(1.0) translate(0,0)" },
          "100%": { transform: "scale(1.12) translate(-2%, -1.5%)" },
        },
        progress: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        slowDrift: {
          "0%, 100%": { transform: "translate(0,0)" },
          "50%": { transform: "translate(1px,1px)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 700ms ease-out both",
        kenBurns: "kenBurns 9s ease-out both",
        progress: "progress linear both",
        slowDrift: "slowDrift 30s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

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
        teaserPop: {
          "0%": { opacity: "0", transform: "scale(0.4) rotate(-3deg)" },
          "60%": { opacity: "1", transform: "scale(1.08) rotate(0deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
        },
        teaserSlideUp: {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        teaserShine: {
          "0%": { transform: "translateX(-100%) skewX(-20deg)" },
          "100%": { transform: "translateX(200%) skewX(-20deg)" },
        },
        accentPulse: {
          "0%, 100%": { boxShadow: "0 0 30px var(--tw-shadow-color), 0 0 60px var(--tw-shadow-color)" },
          "50%": { boxShadow: "0 0 60px var(--tw-shadow-color), 0 0 120px var(--tw-shadow-color)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 700ms ease-out both",
        kenBurns: "kenBurns 9s ease-out both",
        progress: "progress linear both",
        slowDrift: "slowDrift 30s ease-in-out infinite",
        teaserPop: "teaserPop 800ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        teaserSlideUp: "teaserSlideUp 700ms ease-out 600ms both",
        teaserSlideUpLate: "teaserSlideUp 700ms ease-out 1200ms both",
        teaserShine: "teaserShine 2.5s ease-in-out 800ms both",
      },
    },
  },
  plugins: [],
} satisfies Config;

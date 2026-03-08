import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "rgb(var(--brand-ink) / <alpha-value>)",
          inkDeep: "rgb(var(--brand-ink-deep) / <alpha-value>)",
          gold: "rgb(var(--brand-gold) / <alpha-value>)",
          goldSoft: "rgb(var(--brand-gold-soft) / <alpha-value>)",
          surface: "rgb(var(--brand-surface) / <alpha-value>)",
          card: "rgb(var(--brand-card) / <alpha-value>)",
          muted: "rgb(var(--brand-muted) / <alpha-value>)",
          line: "rgb(var(--brand-line) / <alpha-value>)",
          blue: "rgb(var(--brand-blue) / <alpha-value>)",
          green: "rgb(var(--brand-green) / <alpha-value>)",
          amber: "rgb(var(--brand-amber) / <alpha-value>)",
          red: "rgb(var(--brand-red) / <alpha-value>)"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"]
      },
      boxShadow: {
        soft: "0 18px 48px rgba(30, 42, 61, 0.14)",
        glow: "0 20px 60px rgba(245, 200, 66, 0.18)"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      backgroundImage: {
        "hero-grid": "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)"
      }
    }
  },
  plugins: []
};

export default config;

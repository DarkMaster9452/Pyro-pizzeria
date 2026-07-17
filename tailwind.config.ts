import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Driven by CSS vars so each restaurant can theme to its logo.
          // Defaults (Pyro) live in globals.css; [data-brand="polomarik"] overrides.
          primary: "rgb(var(--brand-primary) / <alpha-value>)",
          primaryHover: "rgb(var(--brand-primary-hover) / <alpha-value>)",
          red: "rgb(var(--brand-primary) / <alpha-value>)",
          secondary: "#E85D04",
          accent: "rgb(var(--brand-accent) / <alpha-value>)",
          dark: "#111111",
          surface: "#171717",
          card: "#171717",
          bg: "#FFF8F1",
          ink: "#090909",
          panel: "#111111",
          muted: "#777777",
          sub: "#B5B5B5",
          success: "#22C55E",
          error: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-anton)", "Impact", "system-ui", "sans-serif"],
        script: ["var(--font-pacifico)", "cursive"],
      },
      borderRadius: {
        xl: "18px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(0,0,0,0.18)",
        glow: "0 10px 40px -8px rgba(233,78,27,0.55)",
        card: "0 4px 24px -8px rgba(0,0,0,0.12)",
        lift: "0 24px 60px -20px rgba(0,0,0,0.7)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        spinslow: {
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        spinslow: "spinslow 22s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;

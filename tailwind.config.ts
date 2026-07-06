import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#E63329",
          red: "#E63329",
          primaryDeep: "#B22222",
          secondary: "#E85D04",
          accent: "#F4C542",
          dark: "#191919",
          surface: "#262626",
          bg: "#FFF8F1",
          ink: "#0d0b0b",
          panel: "#171313",
          success: "#2E7D32",
          error: "#C62828",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        heading: ["Anton", "Impact", "system-ui", "sans-serif"],
        script: ["Pacifico", "cursive"],
      },
      borderRadius: {
        xl: "18px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(0,0,0,0.18)",
        glow: "0 8px 30px -6px rgba(230,51,41,0.45)",
        card: "0 4px 24px -8px rgba(0,0,0,0.12)",
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

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#B22222",
          secondary: "#E85D04",
          accent: "#F4C542",
          dark: "#191919",
          surface: "#262626",
          bg: "#FFF8F1",
          success: "#2E7D32",
          error: "#C62828",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "18px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(0,0,0,0.18)",
        glow: "0 8px 30px -6px rgba(178,34,34,0.45)",
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
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};
export default config;

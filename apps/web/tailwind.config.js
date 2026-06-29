/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#f0f3f7",
          raised: "#ffffff",
          sunken: "#e6ebf2",
        },
        ink: {
          DEFAULT: "#0a2540",
          soft: "#425466",
          faint: "#6b7c93",
          inverse: "#f6f9fc",
        },
        line: {
          DEFAULT: "#d6dee8",
          strong: "#b4c0d0",
        },
        accent: {
          DEFAULT: "#0a2540",
          hover: "#0d3356",
          signal: "#0d9488",
          soft: "#ccfbf1",
        },
        danger: {
          DEFAULT: "#c23b22",
          soft: "#fde8e4",
        },
        warn: {
          DEFAULT: "#b45309",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        brand: "-0.03em",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        draw: {
          "0%": { strokeDashoffset: "120" },
          "100%": { strokeDashoffset: "0" },
        },
        drift: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        rise: "rise 0.65s cubic-bezier(0.22,1,0.36,1) both",
        "rise-delay": "rise 0.65s cubic-bezier(0.22,1,0.36,1) 0.1s both",
        "rise-delay-2": "rise 0.65s cubic-bezier(0.22,1,0.36,1) 0.2s both",
        fade: "fade 0.8s ease-out both",
        draw: "draw 1.4s ease-out both",
        drift: "drift 8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

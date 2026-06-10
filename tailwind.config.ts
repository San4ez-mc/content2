import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme palette (GitHub-inspired)
        canvas: {
          DEFAULT: "#0d1117",
          subtle: "#161b22",
          inset: "#010409",
        },
        border: {
          DEFAULT: "#30363d",
          muted: "#21262d",
          subtle: "#1b1f23",
        },
        fg: {
          DEFAULT: "#c9d1d9",
          muted: "#8b949e",
          subtle: "#6e7681",
          on_emphasis: "#ffffff",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#60a5fa",
          muted: "#1d4ed8",
          subtle: "#172554",
          fg: "#ffffff",
        },
        success: {
          DEFAULT: "#10b981",
          fg: "#ecfdf5",
          muted: "#065f46",
          subtle: "#022c22",
        },
        danger: {
          DEFAULT: "#ef4444",
          fg: "#fef2f2",
          muted: "#991b1b",
          subtle: "#450a0a",
        },
        warn: {
          DEFAULT: "#f59e0b",
          fg: "#fffbeb",
          muted: "#92400e",
          subtle: "#451a03",
        },
        // Platform colors
        platform: {
          threads: "#9333ea",
          instagram: "#ec4899",
          linkedin: "#3b82f6",
          tiktok: "#06b6d4",
          youtube: "#ef4444",
          facebook: "#60a5fa",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Plus Jakarta Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-in-right": "slideInRight 0.25s cubic-bezier(0.4,0,0.2,1)",
        "slide-up": "slideUp 0.2s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideInRight: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        slideUp: {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

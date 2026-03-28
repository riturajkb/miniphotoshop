import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,html}"],
  theme: {
    extend: {
      colors: {
        "bg-app": "#1a1a1a",
        "bg-panel": "#1e1e1e",
        "bg-surface": "#2a2a2a",
        "bg-elevated": "#333333",
        "border-default": "#3a3a3a",
        "border-focus": "#4a9eff",
        "text-primary": "#cccccc",
        "text-muted": "#888888",
        accent: "#4a9eff",
        "accent-hover": "#6ab0ff",
        danger: "#ff4a4a",
        success: "#4aff88",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        xs: "11px",
        sm: "12px",
        base: "13px",
        status: "11px",
      },
      spacing: {
        "0.5": "2px",
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
      },
    },
  },
  plugins: [],
} satisfies Config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0d7a73",
          dark: "#005f5a",
          light: "#e6f4f2",
          ring: "#99f2e9",
        },
        ink: {
          DEFAULT: "#0f172a",
          muted: "#334155",
          subtle: "#64748b",
        },
        canvas: "#f8fafc",
        surface: "#ffffff",
        line: {
          DEFAULT: "#cbd5e1",
          soft: "#e2e8f0",
          strong: "#94a3b8",
        },
        triage: {
          red: { DEFAULT: "#991b1b", bg: "#fef2f2", line: "#fca5a5", solid: "#dc2626" },
          amber: { DEFAULT: "#92400e", bg: "#fffbeb", line: "#fcd34d", solid: "#d97706" },
          green: { DEFAULT: "#065f46", bg: "#ecfdf5", line: "#6ee7b7", solid: "#059669" },
        },
        info: { DEFAULT: "#0369a1", bg: "#eff6ff", line: "#93c5fd" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem" }],
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      boxShadow: {
        overlay: "0 4px 6px -1px rgba(15, 23, 42, 0.12)",
        raised: "0 1px 2px 0 rgba(15, 23, 42, 0.06)",
      },
      maxWidth: {
        content: "88rem",
      },
      minHeight: {
        control: "36px",
        touch: "44px",
        "touch-lg": "48px",
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};

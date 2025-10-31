export const ui = {
  colors: {
    page: "var(--page, #F1F5F9)",
    surface: "var(--surface, #FFFFFF)",
    surfaceMuted: "#E2E8F0",
    primary: "#3366FF",
    success: "#22C55E",
    danger: "#EF4444",
    text: "#0F172A",
    textMuted: "#64748B",
    border: "#E2E8F0",
  },
  radius: {
    card: "8px",
  },
  shadow: {
    card: "0 10px 30px rgba(15, 23, 42, 0.05)",
  },
  spacing: {
    pageX: "1.5rem",
    pageY: "1.5rem",
    card: "1.25rem",
  },
} as const;

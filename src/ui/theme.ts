export const ui = {
  colors: {
    page: "var(--color-page, #F1F5F9)",
    surface: "var(--color-surface, #FFFFFF)",
    surfaceMuted: "var(--color-surface-subtle, #F8FAFC)",
    primary: "var(--color-primary, #3366FF)",
    primarySoft: "var(--color-primary-soft, rgba(51,102,255,0.12))",
    success: "var(--color-success, #16A34A)",
    warning: "var(--color-warning, #D97706)",
    danger: "var(--color-danger, #DC2626)",
    text: "var(--color-text-primary, #0F172A)",
    textMuted: "var(--color-text-soft, #64748B)",
    border: "var(--color-border, #CBD5E1)",
  },
  radius: {
    card: "var(--radius-md, 0.75rem)",
    pill: "999px",
  },
  shadow: {
    card: "var(--shadow-card, 0 12px 32px rgba(15,23,42,0.08))",
  },
  spacing: {
    pageX: "var(--space-3, 1.5rem)",
    pageY: "var(--space-3, 1.5rem)",
    card: "var(--space-2, 1rem)",
    gap: "var(--space-1, 0.5rem)",
  },
} as const;

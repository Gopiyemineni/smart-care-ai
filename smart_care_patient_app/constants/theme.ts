export const COLORS = {
  // Backgrounds
  bgDeep: "#020817",
  bgCard: "#0f172a",
  bgCardLight: "#1e293b",
  bgCardHover: "#162032",

  // Brand
  primary: "#00d4ff",
  primaryDim: "rgba(0, 212, 255, 0.1)",
  primaryBorder: "rgba(0, 212, 255, 0.25)",
  accent: "#7c3aed",
  accentDim: "rgba(124, 58, 237, 0.1)",

  // Status
  emergency: "#ef4444",
  emergencyDim: "rgba(239, 68, 68, 0.1)",
  high: "#f59e0b",
  highDim: "rgba(245, 158, 11, 0.1)",
  success: "#10b981",
  successDim: "rgba(16, 185, 129, 0.1)",
  successBorder: "rgba(16, 185, 129, 0.25)",

  // Text
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",

  // Borders
  border: "rgba(255,255,255,0.07)",
  borderLight: "rgba(255,255,255,0.12)",
} as const;

export const FONTS = {
  regular: "System",
  medium: "System",
  bold: "System",
  mono: "monospace",
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 100,
} as const;

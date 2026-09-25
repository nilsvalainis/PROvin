/**
 * Operātora audita rezultāta krāsa (zaļš / oranžs / sarkans) — reklāmas grupēšanai.
 * Nav klienta PDF. Persistē atsevišķā store, ne workspace.
 */

export const AUDIT_RESULT_COLORS = ["green", "orange", "red"] as const;

export type AuditResultColor = (typeof AUDIT_RESULT_COLORS)[number];

export function parseAuditResultColor(v: unknown): AuditResultColor | null {
  if (v === "green" || v === "orange" || v === "red") return v;
  return null;
}

export const AUDIT_RESULT_COLOR_LABEL_LV: Record<AuditResultColor, string> = {
  green: "Zaļš",
  orange: "Oranžs",
  red: "Sarkans",
};

/** Mazais punkts sarakstā / profilā. */
export const AUDIT_RESULT_COLOR_DOT_CLASS: Record<AuditResultColor, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-red-500",
};

export const AUDIT_RESULT_COLOR_RING_CLASS: Record<AuditResultColor, string> = {
  green: "ring-emerald-500",
  orange: "ring-amber-500",
  red: "ring-red-500",
};

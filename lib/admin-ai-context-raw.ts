/** Admin-only papildu konteksts AI promptiem — nekad klienta PDF. */

import { ADMIN_MILEAGE_PASTE_RAW_MAX_LEN } from "@/lib/admin-raw-field-limits";

export const AI_CONTEXT_RAW_SECTION_TITLE = "Papildu AI konteksts (nav PDF)";
export const AI_CONTEXT_RAW_MAX_LEN = ADMIN_MILEAGE_PASTE_RAW_MAX_LEN;
export const AI_CONTEXT_RAW_FIELD_LABEL = "Papildu AI konteksts (nav PDF)";

export function clipAiContextRaw(value: unknown): string {
  return typeof value === "string" ? value.slice(0, AI_CONTEXT_RAW_MAX_LEN) : "";
}

export function appendAiContextRawSection(base: string, raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return base.trim();
  const section = `${AI_CONTEXT_RAW_SECTION_TITLE}\n${t}`;
  const trimmed = base.trim();
  return trimmed ? `${trimmed}\n\n${section}` : section;
}

/** Admin-only papildu konteksts Gemini promptiem — nekad klienta PDF. */

export const GEMINI_CONTEXT_RAW_SECTION_TITLE = "Papildu AI konteksts (nav PDF)";
export const GEMINI_CONTEXT_RAW_MAX_LEN = 24_000;
export const GEMINI_CONTEXT_RAW_FIELD_LABEL = "Papildu AI konteksts (nav PDF)";

export function clipGeminiContextRaw(value: unknown): string {
  return typeof value === "string" ? value.slice(0, GEMINI_CONTEXT_RAW_MAX_LEN) : "";
}

export function appendGeminiContextRawSection(base: string, raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return base.trim();
  const section = `${GEMINI_CONTEXT_RAW_SECTION_TITLE}\n${t}`;
  const trimmed = base.trim();
  return trimmed ? `${trimmed}\n\n${section}` : section;
}

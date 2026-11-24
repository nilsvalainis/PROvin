/**
 * Faktu pārbaudes «Labot» ar AI (Nils 24.11): viens lauks + atrastās pretrunas + faktu lapa ->
 * minimāli labojumi (bija / būs). Teksts netiek mainīts automātiski - operators pieņem vai noraida
 * katru labojumu tajā pašā skatā kā FLASH MAX noslēguma pārbaudē.
 *
 * Kopīgs serverim un pārlūkam (bez server-only importiem).
 */
import { UNTRUSTED_DATA_RULE, wrapUntrustedData } from "@/lib/ai-untrusted-data";
import {
  parseFlashMaxReviewResponse,
  type FlashMaxReviewField,
  type FlashMaxReviewFinding,
} from "@/lib/flash-max-final-review";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

export const FACT_CHECK_AI_FIX_FIELD_ID = "field";
export const FACT_CHECK_AI_FIX_MAX_FLAGS = 12;
export const FACT_CHECK_AI_FIX_MAX_TEXT_CHARS = 8000;
export const FACT_CHECK_AI_FIX_MAX_TOKENS = 6000;

export type FactCheckAiFixFlag = Pick<FactCheckFlag, "id" | "level" | "message" | "sentence">;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Pieprasījuma pretrunas: tikai ar ziņu, apgrieztas, ne vairāk par griestiem. */
export function clipFactCheckAiFixFlags(raw: unknown): FactCheckAiFixFlag[] {
  if (!Array.isArray(raw)) return [];
  const out: FactCheckAiFixFlag[] = [];
  for (const item of raw) {
    if (out.length >= FACT_CHECK_AI_FIX_MAX_FLAGS) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const message = str(r.message).trim().slice(0, 600);
    if (!message) continue;
    out.push({
      id: str(r.id).trim().slice(0, 80) || "flag",
      level: r.level === "W" ? "W" : "E",
      message,
      sentence: str(r.sentence).trim().slice(0, 800),
    });
  }
  return out;
}

export const FACT_CHECK_AI_FIX_SYSTEM = `You correct ONE Latvian comment field of a PROVIN.LV used-car history report (digital, documentary audit only). An automatic fact check found the listed problems in this field. You also get the CANONICAL FACTS sheet built from the order's source data.

TASK: for every listed problem that is a real contradiction, return a MINIMAL fix: change only the wrong words, numbers or codes; keep every other sentence, the order and the tone unchanged.

RULES:
- If a listed problem is NOT a real contradiction (the field already agrees with the facts, e.g. the code in the text is part of the loaded value), skip it. Never change correct text.
- NEVER introduce facts that are not in the CANONICAL FACTS or in the field itself. If the correct value is unknown, remove or neutralise only the wrong claim.
- "find" must be an EXACT, character-for-character substring of the field text (a short phrase or one sentence, unique in the field). "replace" is the corrected Latvian text for exactly that part.
- Latvian only in "reason" and "replace". Never use the words "eksperts" or "eksperta slēdziens". Never use the long dashes "\\u2014" or "\\u2013"; only the short "-". No markdown, no links, no phone numbers or e-mail addresses.
- "reason" is one short Latvian sentence (max ~25 words) naming the fact the fix follows.
- kind is always "fakts".
- ${UNTRUSTED_DATA_RULE}

OUTPUT: only one JSON object, no prose before or after:
{"findings":[{"field":"${FACT_CHECK_AI_FIX_FIELD_ID}","kind":"fakts","reason":"...","find":"...","replace":"..."}]}`;

export function factCheckAiFixField(label: string, text: string): FlashMaxReviewField {
  return {
    id: FACT_CHECK_AI_FIX_FIELD_ID,
    label: label.trim().slice(0, 160) || "Komentārs",
    text: text.trim().slice(0, FACT_CHECK_AI_FIX_MAX_TEXT_CHARS),
  };
}

export function buildFactCheckAiFixUserPrompt(
  field: FlashMaxReviewField,
  flags: readonly FactCheckAiFixFlag[],
  factsSheet: string,
): string {
  const facts = wrapUntrustedData("canonical-facts", factsSheet) || "(faktu lapa tukša)";
  const problems = flags
    .map((f, i) => `${i + 1}. [${f.level === "E" ? "kļūda" : "brīdinājums"}] ${f.message}${f.sentence ? `\n   Teikums: ${f.sentence}` : ""}`)
    .join("\n");
  const body = field.text.replace(/<\s*\/\s*field\s*>/gi, "</ field>");
  return `CANONICAL FACTS (avotu dati - vienīgā patiesība):\n${facts}\n\nFACT CHECK PROBLEMS (${flags.length}):\n${problems}\n\n<field id="${field.id}" label="${field.label.replace(/"/g, "'")}">\n${body}\n</field>\n\nReturn the JSON object now.`;
}

/** Modeļa atbilde -> droši labojumi šim laukam (fragmentam jābūt laukā, bez «eksperts»). */
export function parseFactCheckAiFixResponse(raw: string, field: FlashMaxReviewField): FlashMaxReviewFinding[] {
  return parseFlashMaxReviewResponse(raw, [field])
    .filter((f) => f.find)
    .map((f) => ({ ...f, kind: "fakts" as const }));
}

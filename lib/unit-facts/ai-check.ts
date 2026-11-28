/**
 * Neobligāts lēts AI slānis faktu pārbaudei (tikai Gemini Flash; Anthropic NETIEK lietots).
 * Ieslēgts tikai ar `UNIT_FACT_CHECK_AI=1` un tikai pēc admina pogas «AI pārbaude» (nekad automātiski).
 * Salīdzina ar verificētiem agregātu faktiem UN (28.11) ar šī pasūtījuma kanonisko faktu lapu.
 * Atrod pārfrāzētas pretrunas, ko regex nenoķer. Tekstu NEMAINA.
 */
import "server-only";

import { adminGenerateJsonText } from "@/lib/admin-ai-dispatch";
import { extractJsonObject } from "@/lib/admin-ai-technical-risk-map-types";
import { dropContextExemptFlags, FACT_CHECK_CONTEXT_DIRECTIVE } from "@/lib/fact-check-context";
import { factAppliesToVehicle, splitSentences } from "@/lib/unit-facts/check";
import { UNIT_FACTS } from "@/lib/unit-facts/facts";
import type { FactCheckFlag, FactCheckInput, UnitFact } from "@/lib/unit-facts/types";

export function isUnitFactAiCheckEnabled(): boolean {
  return process.env.UNIT_FACT_CHECK_AI?.trim() === "1";
}

/** Kanoniskās faktu lapas pseido-id AI atbildē. */
export const CANONICAL_AI_FACT_ID = "canonical";

export const UNIT_FACT_AI_SYSTEM = `Tu esi PROVIN faktu pārbaudītājs. Ievadā: VERIFICĒTI FAKTI (ar id) par šo auto, KANONISKIE FAKTI (šī pasūtījuma avotu dati, id "${CANONICAL_AI_FACT_ID}") un TEKSTS (latviski).
Atrodi TIKAI tos teikumus, kas ir tiešā pretrunā ar kādu faktu (nobraukums, datumi, īpašnieku / negadījumu skaits, dzinējs, kārba, jauda u.c.). Neatzīmē stilu, neatzīmē apgalvojumus, par kuriem faktos nekas nav teikts. Ja fakts ir tikai kanoniskajā lapā, fact_id = "${CANONICAL_AI_FACT_ID}".
${FACT_CHECK_CONTEXT_DIRECTIVE}
Atbildi tikai JSON: {"contradictions":[{"fact_id":"...","sentence":"precīzs teikums no TEKSTA","why":"īsi latviski"}]}. Ja nav, {"contradictions":[]}.`;

type AiContradiction = { fact_id?: unknown; sentence?: unknown; why?: unknown };

export function parseAiFactCheck(
  raw: unknown,
  text: string,
  facts: readonly UnitFact[],
  opts: { canonical?: boolean } = {},
): FactCheckFlag[] {
  const list = (raw as { contradictions?: unknown } | null)?.contradictions;
  if (!Array.isArray(list)) return [];
  const sentences = new Set(splitSentences(text));
  const byId = new Map(facts.map((f) => [f.id, f]));
  const out: FactCheckFlag[] = [];
  for (const item of list as AiContradiction[]) {
    const factId = typeof item.fact_id === "string" ? item.fact_id : "";
    const sentence = typeof item.sentence === "string" ? item.sentence.trim() : "";
    const fact = byId.get(factId);
    // Tikai teikumi, kas tiešām ir tekstā (aizsardzība pret halucinētiem citātiem).
    if (!sentence || (!sentences.has(sentence) && !text.includes(sentence))) continue;
    if (!fact) {
      if (opts.canonical && factId === CANONICAL_AI_FACT_ID) {
        out.push({
          id: `ai:${CANONICAL_AI_FACT_ID}`,
          level: "W",
          kind: "contradiction",
          message: `AI pārbaude: ${typeof item.why === "string" ? item.why.trim() : "iespējama pretruna"} (pret pasūtījuma avotu datiem).`,
          sentence,
        });
      }
      continue;
    }
    out.push({
      id: `ai:${fact.id}`,
      level: "W",
      kind: "contradiction",
      message: `AI pārbaude: ${typeof item.why === "string" ? item.why.trim() : "iespējama pretruna"}. Fakts: ${fact.statementLv}`,
      sentence,
      factId: fact.id,
      sources: fact.sources,
    });
  }
  // 27.11: deterministisks filtrs pēc AI - hipotētiski teikumi un obligātās eļļas piebildes nav pretruna.
  return dropContextExemptFlags(out);
}

export function buildUnitFactAiPrompt(applied: readonly UnitFact[], text: string, canonicalSheet?: string): string {
  const parts = [
    `VERIFICĒTI FAKTI:\n${applied.length ? applied.map((f) => `[${f.id}] ${f.statementLv}`).join("\n") : "(nav)"}`,
  ];
  if (canonicalSheet?.trim()) parts.push(`KANONISKIE FAKTI [${CANONICAL_AI_FACT_ID}]:\n${canonicalSheet.trim()}`);
  parts.push(`TEKSTS:\n${text}`);
  return parts.join("\n\n");
}

export async function aiCheckAgainstUnitFacts(
  input: FactCheckInput,
  facts: readonly UnitFact[] = UNIT_FACTS,
  opts: { canonicalSheet?: string } = {},
): Promise<FactCheckFlag[]> {
  if (!isUnitFactAiCheckEnabled()) return [];
  const vehicleText = `${input.vehicleLabel ?? ""}\n${input.contextText ?? ""}`;
  const applied = facts.filter(
    (f) => f.status === "verified" && factAppliesToVehicle(f, vehicleText, input.year ?? null),
  );
  const canonical = Boolean(opts.canonicalSheet?.trim());
  if ((applied.length === 0 && !canonical) || !input.text.trim()) return [];
  const userPrompt = buildUnitFactAiPrompt(applied, input.text, opts.canonicalSheet);
  try {
    const raw = await adminGenerateJsonText({
      modelTier: "gemini-flash",
      systemInstruction: UNIT_FACT_AI_SYSTEM,
      userPrompt,
      maxTokens: 2_000,
    });
    return parseAiFactCheck(extractJsonObject(raw), input.text, applied, { canonical });
  } catch {
    return [];
  }
}

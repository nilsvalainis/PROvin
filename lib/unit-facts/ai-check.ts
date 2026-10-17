/**
 * Neobligāts lēts AI slānis faktu pārbaudei (tikai Gemini Flash; Anthropic NETIEK lietots).
 * Ieslēgts tikai ar `UNIT_FACT_CHECK_AI=1` un tikai, ja auto ir vismaz viens verificēts fakts.
 * Atrod pārfrāzētas pretrunas, ko regex nenoķer. Tekstu NEMAINA.
 */
import "server-only";

import { adminGenerateJsonText } from "@/lib/admin-ai-dispatch";
import { extractJsonObject } from "@/lib/admin-ai-technical-risk-map-types";
import { factAppliesToVehicle, splitSentences } from "@/lib/unit-facts/check";
import { UNIT_FACTS } from "@/lib/unit-facts/facts";
import type { FactCheckFlag, FactCheckInput, UnitFact } from "@/lib/unit-facts/types";

export function isUnitFactAiCheckEnabled(): boolean {
  return process.env.UNIT_FACT_CHECK_AI?.trim() === "1";
}

const SYSTEM = `Tu esi PROVIN faktu pārbaudītājs. Ievadā: VERIFICĒTI FAKTI (ar id) par šo auto un TEKSTS (latviski).
Atrodi TIKAI tos teikumus, kas ir tiešā pretrunā ar kādu faktu. Neatzīmē stilu, neatzīmē apgalvojumus, par kuriem faktos nekas nav teikts.
Atbildi tikai JSON: {"contradictions":[{"fact_id":"...","sentence":"precīzs teikums no TEKSTA","why":"īsi latviski"}]}. Ja nav, {"contradictions":[]}.`;

type AiContradiction = { fact_id?: unknown; sentence?: unknown; why?: unknown };

export function parseAiFactCheck(raw: unknown, text: string, facts: readonly UnitFact[]): FactCheckFlag[] {
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
    if (!fact || !sentence || (!sentences.has(sentence) && !text.includes(sentence))) continue;
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
  return out;
}

export async function aiCheckAgainstUnitFacts(
  input: FactCheckInput,
  facts: readonly UnitFact[] = UNIT_FACTS,
): Promise<FactCheckFlag[]> {
  if (!isUnitFactAiCheckEnabled()) return [];
  const vehicleText = `${input.vehicleLabel ?? ""}\n${input.contextText ?? ""}`;
  const applied = facts.filter(
    (f) => f.status === "verified" && factAppliesToVehicle(f, vehicleText, input.year ?? null),
  );
  if (applied.length === 0 || !input.text.trim()) return [];
  const userPrompt = `VERIFICĒTI FAKTI:\n${applied.map((f) => `[${f.id}] ${f.statementLv}`).join("\n")}\n\nTEKSTS:\n${input.text}`;
  try {
    const raw = await adminGenerateJsonText({
      modelTier: "gemini-flash",
      systemInstruction: SYSTEM,
      userPrompt,
      maxTokens: 2_000,
    });
    return parseAiFactCheck(extractJsonObject(raw), input.text, applied);
  } catch {
    return [];
  }
}

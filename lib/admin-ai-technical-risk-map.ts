import "server-only";

import { adminGenerateRawTextWithWebSearch } from "@/lib/admin-ai-dispatch";
import { isAiIncompleteCommentError } from "@/lib/admin-ai-incomplete";
import { AI_TECH_RISK_V2_MAP_SYSTEM } from "@/lib/admin-ai-tech-risk-v2-prompts";
import {
  resolveTechRiskV2Tiers,
  TECH_RISK_V2_ANTHROPIC_MAX_SEARCHES,
  type TechRiskV2Tiers,
} from "@/lib/admin-ai-tech-pipeline-config";
import {
  parseTechnicalRiskMapFromAiText,
  type TechnicalRiskIdentification,
  type TechnicalRiskMap,
} from "@/lib/admin-ai-technical-risk-map-types";
import { formatEngineIdentificationForPrompt } from "@/lib/admin-ai-engine-identification";
import { formatMatchingProvinKbForPrompt } from "@/lib/provin-kb";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import type { AiTextStream } from "@/lib/ai-text-stream";

export function mergeIdentificationIntoMap(
  map: TechnicalRiskMap,
  identification: TechnicalRiskIdentification,
): TechnicalRiskMap {
  const engine =
    identification.engine.confidence === "A" || !map.identification.engine.value
      ? identification.engine
      : map.identification.engine;
  return {
    ...map,
    identification: {
      engine,
      gearbox:
        identification.gearbox.confidence === "A" || !map.identification.gearbox.value
          ? identification.gearbox
          : map.identification.gearbox,
      platform:
        identification.platform.confidence === "A" || !map.identification.platform.value
          ? identification.platform
          : map.identification.platform,
      drive: identification.drive ?? map.identification.drive,
    },
    recalls:
      map.recalls.length > 0
        ? map.recalls
        : [{ id_or_title: "nav atrasts", source: "meklēšana", status_known: false }],
  };
}

/** Kartei vajag vietu meklējumu rezultātiem + JSON; 12k bija par maz (A/B 2026-10-17). */
export const TECH_RISK_MAP_MAX_TOKENS = 20_000;
const TECH_RISK_MAP_COMPACT_RETRY =
  "IEPRIEKŠĒJĀ KARTE BIJA NEDERĪGA VAI PĀRĀK GARA. Tagad: tieši shēmas atslēgas, maks. 8 riski (katram \"component\"), katrs teksta lauks līdz 160 rakstzīmēm, maks. 2 avoti riskam, bez teksta ārpus JSON.";

/** Riska komponenta salīdzināšanai (reģistrs, atstarpes). */
function componentKey(c: string): string {
  return c.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Aizstāj/papildina kartes riskus ar Claude riskiem tikai norādītajiem agregātiem. */
export function mergeAnthropicComponentRisks(
  map: TechnicalRiskMap,
  extra: TechnicalRiskMap | null,
): TechnicalRiskMap {
  if (!extra || extra.risks.length === 0) return map;
  const byKey = new Map(extra.risks.map((r) => [componentKey(r.component), r]));
  const kept = map.risks.filter((r) => !byKey.has(componentKey(r.component)));
  return { ...map, risks: [...kept, ...extra.risks], recalls: map.recalls };
}

/**
 * MANUĀLS, noklusējumā izslēgts: Claude tikai operatora nosauktajiem agregātiem.
 * Ieslēdz tikai operators, izvēloties Claude līmeni esošajā selektorā + komandu `Claude: …`.
 */
async function supplementMapWithAnthropic(opts: {
  map: TechnicalRiskMap;
  tier: NonNullable<TechRiskV2Tiers["anthropicComponentsTier"]>;
  components: string[];
  userPrompt: string;
  stream?: AiTextStream;
}): Promise<TechnicalRiskMap> {
  try {
    const raw = await adminGenerateRawTextWithWebSearch({
      modelTier: opts.tier,
      systemInstruction: AI_TECH_RISK_V2_MAP_SYSTEM,
      userPrompt: `${opts.userPrompt}

---
OPERATORA IZVĒLE: padziļināti TIKAI šie agregāti: ${opts.components.join(", ")}.
Atgriez to pašu JSON shēmu, bet "risks" tikai šiem agregātiem; pārējos laukus vari atstāt tukšus.`,
      temperature: 0.1,
      maxSearches: TECH_RISK_V2_ANTHROPIC_MAX_SEARCHES,
      maxTokens: TECH_RISK_MAP_MAX_TOKENS,
      stream: opts.stream,
      skipLatvianPolish: true,
    });
    return mergeAnthropicComponentRisks(opts.map, parseTechnicalRiskMapFromAiText(raw));
  } catch (e) {
    console.warn("[tech-risk-v2] anthropic_components_failed", e instanceof Error ? e.message : e);
    return opts.map;
  }
}

export async function generateTechnicalRiskMapWithAi(input: {
  modelTier?: AiAdminModelTier | null;
  orderContext: string;
  identification: TechnicalRiskIdentification;
  identificationBrief: string;
  /** OFICIĀLĀ DĪLERA FAKTI ar ID (D1…); tukšs, ja OneAuto datu nav. */
  dealerFactsBrief?: string;
  /** Operatora izvēlētie līmeņi (`resolveTechRiskV2Tiers`); ja nav, no `modelTier`. */
  tiers?: TechRiskV2Tiers;
  /** Manuāls Claude papildinājums tikai šiem agregātiem (operatora komanda `Claude: …`). */
  anthropicComponents?: string[];
  stream?: AiTextStream;
}): Promise<TechnicalRiskMap> {
  const tiers = input.tiers ?? resolveTechRiskV2Tiers(input.modelTier);
  const kbBlock = formatMatchingProvinKbForPrompt([
    input.identification.engine.value,
    ...input.identification.engine.candidates,
    input.identification.gearbox.value,
    ...input.identification.gearbox.candidates,
  ]);
  const userPrompt = `IDENTIFIKĀCIJA (jau noteikta, neizdomā citu kodu):
${formatEngineIdentificationForPrompt(input.identification)}

${input.identificationBrief}

${kbBlock}

${input.dealerFactsBrief?.trim() ? `${input.dealerFactsBrief.trim()}\n\n` : ""}${input.orderContext}

---

Sastādi RISKA KARTI. ATSAUKUMU solis ir obligāts: meklē ražotāja / KBA / EU Safety Gate (NHTSA tikai, ja attiecas uz šo tirgu/VIN).
Ja atsaukums nav atrasts, recalls = [{"id_or_title":"nav atrasts","source":"KBA/NHTSA/EU Safety Gate","status_known":false}].
Neizdomā kampaņu numurus. Maksas detaļu katalogu cenas nav avots. Ja datu nav, unknowns[] un neuzminēt.
Izeja: tikai JSON.`;

  // Gemini kartes solis: viens grounding izsaukums, bez self-correction (JSON), bez Claude.
  const run = (extra = "") =>
    adminGenerateRawTextWithWebSearch({
      modelTier: tiers.facts,
      systemInstruction: AI_TECH_RISK_V2_MAP_SYSTEM,
      userPrompt: extra ? `${userPrompt}\n\n${extra}` : userPrompt,
      maxTokens: TECH_RISK_MAP_MAX_TOKENS,
      stream: input.stream,
    });
  let raw: string;
  try {
    raw = await run();
  } catch (e) {
    if (!isAiIncompleteCommentError(e)) throw e;
    raw = await run(TECH_RISK_MAP_COMPACT_RETRY);
  }
  let parsed = parseTechnicalRiskMapFromAiText(raw);
  if (!parsed || parsed.risks.length === 0) {
    // Tukša/nederīga karte (A/B 17.10: 16/20) — viens kompakts atkārtojums ar to pašu Gemini.
    parsed = parseTechnicalRiskMapFromAiText(await run(TECH_RISK_MAP_COMPACT_RETRY)) ?? parsed;
  }
  if (!parsed) {
    throw new Error("ai_invalid_json");
  }
  const components = input.anthropicComponents?.filter((c) => c.trim()) ?? [];
  if (tiers.anthropicComponentsTier && components.length > 0) {
    parsed = await supplementMapWithAnthropic({
      map: parsed,
      tier: tiers.anthropicComponentsTier,
      components,
      userPrompt,
      stream: input.stream,
    });
  }
  return mergeIdentificationIntoMap(parsed, input.identification);
}

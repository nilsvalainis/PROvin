import "server-only";

import { adminGenerateTextWithWebSearch } from "@/lib/admin-ai-dispatch";
import { AI_TECH_RISK_V2_MAP_SYSTEM } from "@/lib/admin-ai-tech-risk-v2-prompts";
import { TECH_PIPELINE, TECH_PIPELINE_DEEP_FACTS_TIER } from "@/lib/admin-ai-tech-pipeline-config";
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

export async function generateTechnicalRiskMapWithAi(input: {
  modelTier?: AiAdminModelTier | null;
  orderContext: string;
  identification: TechnicalRiskIdentification;
  identificationBrief: string;
  stream?: AiTextStream;
}): Promise<TechnicalRiskMap> {
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

${input.orderContext}

---

Sastādi RISKA KARTI. ATSAUKUMU solis ir obligāts: meklē ražotāja / KBA / NHTSA / EU Safety Gate.
Ja atsaukums nav atrasts, recalls = [{"id_or_title":"nav atrasts","source":"KBA/NHTSA/EU Safety Gate","status_known":false}].
Neizdomā kampaņu numurus. Maksas detaļu katalogu cenas nav avots. Ja datu nav, unknowns[] un neuzminēt.
Izeja: tikai JSON.`;

  const factsTier =
    input.modelTier === "flash" || input.modelTier === "pro"
      ? TECH_PIPELINE_DEEP_FACTS_TIER
      : TECH_PIPELINE.technical_risks.facts;

  const raw = await adminGenerateTextWithWebSearch({
    modelTier: factsTier,
    systemInstruction: AI_TECH_RISK_V2_MAP_SYSTEM,
    userPrompt,
    qualityField: "technical_risks",
    temperature: 0.1,
    maxSearches: TECH_PIPELINE.technical_risks.maxSearches,
    maxTokens: 12_000,
    stream: input.stream,
  });
  const parsed = parseTechnicalRiskMapFromAiText(raw);
  if (!parsed) {
    throw new Error("ai_invalid_json");
  }
  return mergeIdentificationIntoMap(parsed, input.identification);
}

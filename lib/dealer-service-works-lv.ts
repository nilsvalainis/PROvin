/**
 * Dīlera servisa darbu AI tulkojums latviski (pēc vārdnīcas palikušie EN/DE nosaukumi).
 *
 * Struktūru (datumi, km, vieta) nosaka teksta slāņa parseris — šis slānis tikai
 * pārtulko „Veiktie darbi” pēc nozīmes, neizdomājot jaunas pozīcijas.
 */

import { JsonType, type AiJsonSchema } from "@/lib/ai-json-schema";
import { buildBannedVocabularyPromptRules } from "@/lib/provin-banned-vocabulary";
import {
  applyServiceWorkTranslations,
  collectUntranslatedServiceWorks,
} from "@/lib/service-work-term-lv";
import type { VendorServiceEntry } from "@/lib/vendor-service-history";

export const DEALER_SERVICE_WORKS_LV_SYSTEM = `You are the PROVIN.LV translator for official dealer / factory service-history work items (BMW ETK, Mercedes, VW workshop printouts, etc.).

TASK
- Translate each listed work / part name into polished, grammatical Latvian for a vehicle history report („Veiktie darbi”).
- Translate by MEANING, not word-for-word. Workshop catalogue English/German should become what a Latvian technician would write.
- Keep the same items, same order, same count. Never invent, merge, drop or split items. Never add dates, odometers, dealer names or part numbers.

STYLE
- Natural Latvian: „Eļļas filtra komplekts”, not „Komplekts eļļas filtra elements”.
- Always „automašīna” / „Automašīnas” — never „automobilis”, „automobīlis”, „Automobiļa”.
- Qualifiers in parentheses: front → (priekšā), rear → (aizmugurē), ventilated → (ventilēts).
- „Vehicle check additional scope” / „additional vehicle check” → „Automašīnas pārbaudes papildu apjoms”; hood/bonnet gas spring check → „Motora pārsega gāzes atsperu pārbaude”; pre-delivery inspection → „Pirmspiegādes apskate”.
- Keep brand names and oil/fluid specifications as printed (Castrol, BMW Group LL-04, 5W-30, DOT4, AGM, Service Inclusive).
- Crankshaft pulley / harmonic balancer / torsional damper → „kloķvārpstas skriemelis (demferis)”.
- ${buildBannedVocabularyPromptRules()}
- Internal workshop notes still get a clear Latvian meaning: „Kundenloyalisierung siehe Mail” → „Klienta lojalitātes akcija (sk. e-pastu)”; „Nachrüstung Service-Inclusive” → „Service Inclusive pievienošana”; „Ölzuschlag für Service Inclusive” → „Eļļas piemaksa (Service Inclusive)”.
- Do not leave English or German words except brands/specs.
- Never use *, ** or em/en dashes (— –). ASCII hyphen only if a hyphen is needed.

Return JSON only.`;

export const DEALER_SERVICE_WORKS_LV_SCHEMA: AiJsonSchema = {
  type: JsonType.OBJECT,
  properties: {
    items: {
      type: JsonType.ARRAY,
      items: {
        type: JsonType.OBJECT,
        properties: {
          original: { type: JsonType.STRING },
          lv: { type: JsonType.STRING },
        },
        required: ["original", "lv"],
      },
    },
  },
  required: ["items"],
};

export function parseDealerServiceWorksLvPayload(raw: string): Record<string, string> {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("ai_invalid_json");
  }
  const root = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const items = Array.isArray(root.items) ? root.items : [];
  const out: Record<string, string> = {};
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const original = String(row.original ?? "").replace(/\s+/g, " ").trim();
    const lv = String(row.lv ?? "").replace(/\s+/g, " ").trim();
    if (!original || !lv) continue;
    out[original] = lv;
  }
  return out;
}

export function applyDealerServiceWorksLvPayload(
  entries: VendorServiceEntry[],
  raw: string,
): VendorServiceEntry[] {
  return applyServiceWorkTranslations(entries, parseDealerServiceWorksLvPayload(raw));
}

export { collectUntranslatedServiceWorks };

import "server-only";

import { getAnthropicApiKeyFromEnv } from "@/lib/admin-ai";
import { adminGenerateJsonText, hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import { originalDealerWorksForRow } from "@/lib/admin-ai-dealer-facts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import { AI_ADMIN_MODEL_TIER_DEFAULT } from "@/lib/ai-admin-model-tier";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { repairDealerImportText } from "@/lib/dealer-text-repair";
import {
  countUntranslatedDealerWorkRows,
  dealerWorkRowNeedsLvTranslation,
} from "@/lib/dealer-admin-service-rows";
import {
  filledOneautoKvRows,
  filledOneautoServiceEvents,
  type OneautoDisplaySections,
  type OneautoServiceEvent,
} from "@/lib/oneauto-catalog";
import {
  applyOneautoTranslatedDisplay,
  applyOneautoTranslatedWorks,
  oneautoDisplayWorksNeedLvTranslation,
  oneautoWorksNeedLvTranslation,
  parseOneautoTranslateDisplay,
  parseOneautoWorksTranslatePayload,
} from "@/lib/oneauto-dealer";

const ONEAUTO_TRANSLATE_SYSTEM = `You translate OEM / dealer vehicle data into clear Latvian for a professional car-history report.

RULES:
- Output JSON only: { "powertrain": [{"label","value"}], "serviceTimeline": [{"date","odometer","place","works"}] }.
- Keep the same number of rows and the same order as the input.
- NEVER translate Gatavā komplektācija / factory equipment lists. Those stay in the original language.
- Translate English, Dutch, German, Russian (Cyrillic) and other foreign powertrain labels and work descriptions into clear Latvian.
- Keep OEM codes, part numbers, VIN fragments, software IDs (ECM, PBM, QB) unchanged.
- German OEM exports may contain "\uFFFD" (shown as �) where an umlaut, ß or § was lost: MOTOR�L = Motoröl, R�DERWECHSEL = Räderwechsel, SICHERHEITSPR�FG / SICHERHEITSPRFG = Sicherheitsprüfung, "� 57" = § 57 (Austrian §57a periodic inspection). Infer the intended German word from workshop context and translate it. Never output � or raw German.
- Do not invent facts, dates, km or extra rows.
- Dates and odometer values stay exactly as given.
- No markdown. No em dash. No EUR repair estimates.
- Latvian, client-readable, compact.`;

/**
 * Noklusējums Gemini (Smart). Ja Gemini nav pieejams vai atbilde neder, viens mēģinājums ar Claude Sonnet,
 * lai dīlera rindas nepaliek svešvalodā.
 */
async function generateDealerTranslationJson(args: {
  modelTier: AiAdminModelTier;
  systemInstruction: string;
  userPrompt: string;
  temperature: number;
  parse: (raw: string) => boolean;
}): Promise<string> {
  let primaryError: unknown = null;
  try {
    const raw = await adminGenerateJsonText({
      modelTier: args.modelTier,
      systemInstruction: args.systemInstruction,
      userPrompt: args.userPrompt,
      temperature: args.temperature,
    });
    if (args.parse(raw)) return raw;
    primaryError = new Error("ai_invalid_json");
  } catch (e) {
    primaryError = e;
  }
  if (args.modelTier === "flash" || !getAnthropicApiKeyFromEnv()) throw primaryError;
  console.warn(
    "[dealer-translate] Gemini neizdevās, Sonnet rezerve:",
    primaryError instanceof Error ? primaryError.message : primaryError,
  );
  return adminGenerateJsonText({
    modelTier: "flash",
    systemInstruction: args.systemInstruction,
    userPrompt: args.userPrompt,
    temperature: args.temperature,
  });
}

function jsonParses(raw: string, check: (v: unknown) => unknown): boolean {
  try {
    return Boolean(check(JSON.parse(raw)));
  } catch {
    return false;
  }
}

export async function translateOneautoDisplayWithAi(input: {
  display: OneautoDisplaySections;
  operatorNotes?: string | null;
  modelTier?: AiAdminModelTier | null;
}): Promise<OneautoDisplaySections> {
  const current = {
    equipment: filledOneautoKvRows(input.display.equipment),
    powertrain: filledOneautoKvRows(input.display.powertrain),
    serviceTimeline: filledOneautoServiceEvents(input.display.serviceTimeline).map((ev) => ({
      ...ev,
      works: repairDealerImportText(ev.works),
    })),
  };
  if (current.powertrain.length === 0 && current.serviceTimeline.length === 0) {
    if (current.equipment.length === 0) throw new Error("empty_source_data");
    return input.display;
  }

  const userPrompt = appendAiOperatorNotesSection(
    `Iztulko šos OneAuto OEM datus skaidrā latviešu valodā. Saglabā rindu skaitu un kārtību.
Gatavo komplektāciju (equipment) NETULKO un neatgriez.

${JSON.stringify({ powertrain: current.powertrain, serviceTimeline: current.serviceTimeline }, null, 2)}

Atbildi tikai ar JSON.`,
    { operatorNotes: input.operatorNotes },
  );

  const raw = await generateDealerTranslationJson({
    modelTier: input.modelTier ?? "gemini-flash",
    systemInstruction: ONEAUTO_TRANSLATE_SYSTEM,
    userPrompt,
    temperature: 0.15,
    parse: (r) => jsonParses(r, parseOneautoTranslateDisplay),
  });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("ai_invalid_json");
  }
  const parsed = parseOneautoTranslateDisplay(parsedJson);
  if (!parsed) throw new Error("ai_invalid_json");
  return applyOneautoTranslatedDisplay(current, parsed);
}

const ONEAUTO_WORKS_TRANSLATE_SYSTEM = `You translate OEM dealer service-work descriptions into clear Latvian.

RULES:
- Output JSON only: { "works": ["...", "..."] }.
- Same number of strings, same order as the input array.
- Translate English, Dutch, German and other foreign work text into clear Latvian by meaning in workshop context, not word-for-word calques.
- Keep OEM codes, part numbers, software IDs (ECM, PBM, QB, VIDA) unchanged.
- German OEM exports may contain "\uFFFD" (shown as �) where an umlaut, ß or § was lost: MOTOR�L = Motoröl, R�DERWECHSEL = Räderwechsel, SICHERHEITSPR�FG / SICHERHEITSPRFG = Sicherheitsprüfung, "� 57" = § 57 (Austrian §57a periodic inspection). Infer the intended German word from workshop context and translate it. Never output � or raw German.
- Do not invent jobs, dates or km.
- No markdown. No em dash. No EUR.
- Latvian, client-readable, compact.`;

export async function translateOneautoWorksWithAi(input: {
  display: OneautoDisplaySections;
  operatorNotes?: string | null;
  modelTier?: AiAdminModelTier | null;
}): Promise<OneautoDisplaySections> {
  const events = filledOneautoServiceEvents(input.display.serviceTimeline);
  if (events.length === 0) throw new Error("empty_source_data");

  const userPrompt = appendAiOperatorNotesSection(
    `Iztulko TIKAI šos servisa darbu tekstus skaidrā latviešu valodā. Saglabā skaitu un kārtību.

${JSON.stringify(
  events.map((ev) => repairDealerImportText(ev.works)),
  null,
  2,
)}

Atbildi tikai ar JSON: { "works": ["..."] }.`,
    { operatorNotes: input.operatorNotes },
  );

  const raw = await generateDealerTranslationJson({
    modelTier: input.modelTier ?? AI_ADMIN_MODEL_TIER_DEFAULT,
    systemInstruction: ONEAUTO_WORKS_TRANSLATE_SYSTEM,
    userPrompt,
    temperature: 0.1,
    parse: (r) => jsonParses(r, parseOneautoWorksTranslatePayload),
  });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("ai_invalid_json");
  }
  const works = parseOneautoWorksTranslatePayload(parsedJson);
  if (!works) throw new Error("ai_invalid_json");
  return applyOneautoTranslatedWorks(input.display, works);
}

/** Ielādes ceļš: pārtulko „Darbi”, ja teksts vēl nav latviski. AI kļūda neatceļ OEM datus. */
export async function translateOneautoWorksOnIngest(
  display: OneautoDisplaySections,
): Promise<OneautoDisplaySections> {
  if (!oneautoDisplayWorksNeedLvTranslation(display)) return display;
  if (!hasAnyAdminAiProviderKey()) return display;
  try {
    return await translateOneautoWorksWithAi({ display, modelTier: AI_ADMIN_MODEL_TIER_DEFAULT });
  } catch (e) {
    console.error("[oneauto-works-ingest]", e instanceof Error ? e.message : e);
    return display;
  }
}

export type EnsureDealerServiceWorksLvResult = {
  serviceWorks: AutoRecordsServiceWorkRow[];
  translatedCount: number;
  warning: string | null;
};

/**
 * Pirms PROVIN AUDITS / BUSINESS / dīlera LV PDF: ja rindas vēl svešvalodā,
 * kontekstuali pārtulko ar Gemini (noklusējums, bez Anthropic) un raksta serviceWorks.
 * Kļūda neatceļ ģenerāciju - atgriež brīdinājumu.
 */
export async function ensureDealerServiceWorksLatvian(args: {
  serviceWorks: readonly AutoRecordsServiceWorkRow[] | null | undefined;
  originalTimeline?: readonly OneautoServiceEvent[] | null;
}): Promise<EnsureDealerServiceWorksLvResult> {
  const serviceWorks = [...(args.serviceWorks ?? [])];
  if (countUntranslatedDealerWorkRows(serviceWorks) === 0) {
    return { serviceWorks, translatedCount: 0, warning: null };
  }
  if (!hasAnyAdminAiProviderKey()) {
    const warning =
      "Dīlera darbu automātiskais tulkojums izlaists: nav AI atslēgas. PDF ģenerēts ar esošajām rindām.";
    console.warn("[dealer-works-lv]", warning);
    return { serviceWorks, translatedCount: 0, warning };
  }

  const indices: number[] = [];
  const timeline: OneautoServiceEvent[] = [];
  serviceWorks.forEach((row, i) => {
    if (!dealerWorkRowNeedsLvTranslation(row.works ?? "")) return;
    const source = originalDealerWorksForRow(row, args.originalTimeline) || (row.works ?? "");
    if (!source.trim()) return;
    indices.push(i);
    timeline.push({
      date: row.date,
      odometer: row.odometer,
      place: row.location,
      works: source,
    });
  });
  if (timeline.length === 0) {
    return { serviceWorks, translatedCount: 0, warning: null };
  }

  try {
    const translated = await translateOneautoWorksWithAi({
      display: { equipment: [], powertrain: [], serviceTimeline: timeline },
      modelTier: AI_ADMIN_MODEL_TIER_DEFAULT,
    });
    const events = filledOneautoServiceEvents(translated.serviceTimeline);
    const next = serviceWorks.map((row, i) => {
      const slot = indices.indexOf(i);
      if (slot < 0) return row;
      const lv = (events[slot]?.works ?? "").replace(/\s+/g, " ").trim();
      if (!lv || oneautoWorksNeedLvTranslation(lv)) return row;
      return { ...row, works: lv };
    });
    const still = countUntranslatedDealerWorkRows(next);
    const translatedCount = countUntranslatedDealerWorkRows(serviceWorks) - still;
    const warning =
      still > 0
        ? `Daļa dīlera rindu palika netulkotas (${still}). PDF ģenerēts ar pieejamajām rindām.`
        : null;
    if (warning) console.warn("[dealer-works-lv]", warning);
    return { serviceWorks: next, translatedCount, warning };
  } catch (e) {
    const warning =
      "Dīlera darbu automātiskais tulkojums neizdevās. PDF ģenerēts ar esošajām rindām.";
    console.warn("[dealer-works-lv]", e instanceof Error ? e.message : e);
    return { serviceWorks, translatedCount: 0, warning };
  }
}

import "server-only";

import { adminGenerateJsonText, hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import {
  filledOneautoKvRows,
  filledOneautoServiceEvents,
  type OneautoDisplaySections,
} from "@/lib/oneauto-catalog";
import {
  applyOneautoTranslatedDisplay,
  applyOneautoTranslatedWorks,
  oneautoDisplayWorksNeedLvTranslation,
  parseOneautoTranslateDisplay,
  parseOneautoWorksTranslatePayload,
} from "@/lib/oneauto-dealer";

const ONEAUTO_TRANSLATE_SYSTEM = `You translate OEM / dealer vehicle data into clear Latvian for a professional car-history report.

RULES:
- Output JSON only: { "powertrain": [{"label","value"}], "serviceTimeline": [{"date","odometer","place","works"}] }.
- Keep the same number of rows and the same order as the input.
- NEVER translate Gatavā komplektācija / factory equipment lists. Those stay in the original language.
- Translate English, Dutch, German and other foreign powertrain labels and work descriptions into clear Latvian.
- Keep OEM codes, part numbers, VIN fragments, software IDs (ECM, PBM, QB) unchanged.
- Do not invent facts, dates, km or extra rows.
- Dates and odometer values stay exactly as given.
- No markdown. No em dash. No EUR repair estimates.
- Latvian, client-readable, compact.`;

export async function translateOneautoDisplayWithAi(input: {
  display: OneautoDisplaySections;
  operatorNotes?: string | null;
  modelTier?: AiAdminModelTier | null;
}): Promise<OneautoDisplaySections> {
  const current = {
    equipment: filledOneautoKvRows(input.display.equipment),
    powertrain: filledOneautoKvRows(input.display.powertrain),
    serviceTimeline: filledOneautoServiceEvents(input.display.serviceTimeline),
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

  const raw = await adminGenerateJsonText({
    modelTier: input.modelTier ?? "gemini-flash",
    systemInstruction: ONEAUTO_TRANSLATE_SYSTEM,
    userPrompt,
    temperature: 0.15,
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
- Translate English, Dutch, German and other foreign work text into clear Latvian.
- Keep OEM codes, part numbers, software IDs (ECM, PBM, QB, VIDA) unchanged.
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
  events.map((ev) => ev.works),
  null,
  2,
)}

Atbildi tikai ar JSON: { "works": ["..."] }.`,
    { operatorNotes: input.operatorNotes },
  );

  const raw = await adminGenerateJsonText({
    modelTier: input.modelTier ?? "gemini-flash",
    systemInstruction: ONEAUTO_WORKS_TRANSLATE_SYSTEM,
    userPrompt,
    temperature: 0.1,
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
    return await translateOneautoWorksWithAi({ display, modelTier: "gemini-flash" });
  } catch (e) {
    console.error("[oneauto-works-ingest]", e instanceof Error ? e.message : e);
    return display;
  }
}

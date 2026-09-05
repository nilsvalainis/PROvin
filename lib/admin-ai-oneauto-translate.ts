import "server-only";

import { adminGenerateJsonText } from "@/lib/admin-ai-dispatch";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import {
  filledOneautoKvRows,
  filledOneautoServiceEvents,
  type OneautoDisplaySections,
} from "@/lib/oneauto-catalog";
import { applyOneautoTranslatedDisplay, parseOneautoTranslateDisplay } from "@/lib/oneauto-dealer";

const ONEAUTO_TRANSLATE_SYSTEM = `You translate OEM / dealer vehicle data into clear Latvian for a professional car-history report.

RULES:
- Output JSON only: { "equipment": [{"label","value"}], "powertrain": [{"label","value"}], "serviceTimeline": [{"date","odometer","place","works"}] }.
- Keep the same number of rows and the same order as the input.
- Translate English, Dutch, German and other foreign labels and work descriptions into clear Latvian.
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
  if (
    current.equipment.length === 0 &&
    current.powertrain.length === 0 &&
    current.serviceTimeline.length === 0
  ) {
    throw new Error("empty_source_data");
  }

  const userPrompt = appendAiOperatorNotesSection(
    `Iztulko šos OneAuto OEM datus skaidrā latviešu valodā. Saglabā rindu skaitu un kārtību.

${JSON.stringify(current, null, 2)}

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

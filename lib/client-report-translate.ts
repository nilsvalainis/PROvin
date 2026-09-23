import "server-only";

import { adminGenerateJsonText } from "@/lib/admin-ai-dispatch";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import type { TranslatableFieldMap } from "@/lib/client-report-translatable-fields";
import type { ClientReportTargetLang } from "@/lib/client-report-i18n";

const REPORT_TRANSLATE_SYSTEM = (langName: string) => `You translate a Latvian vehicle-history report (PROVIN.LV) into ${langName} for the end customer who is buying a used car.

RULES:
- Output JSON only: a flat object with EXACTLY the same keys as the input. Each value is the ${langName} translation of the source value.
- Translate by MEANING and context, never word-for-word. Natural, professional, client-facing tone, as a native ${langName} speaker would write it.
- Values may be full paragraphs OR short labels, table cells, country names, inspection grades and defect lines. Translate each value on its own. Leave no Latvian words in the value.
- German or English workshop lines that are already not Latvian (OEM job names) stay unchanged.
- NEVER change or convert: numbers, dates, mileage/km values, VIN, license plates, currency amounts (keep € symbol as-is), OEM/error/diagnostic codes.
- NEVER invent facts, dates, figures, or sentences that are not present in the source text.
- Keep brand, company and model names unchanged exactly as written (AutoDNA, CarVertical, CSDD, LTAB, Tesla, Audi, PROVIN, etc.).
- Do not use an em dash (—) or en dash (–) anywhere. If the source used a hyphen "-", keep a plain hyphen.
- No markdown formatting (no **, no #, no bullet dashes).
- If an input value is an empty string, return it as an empty string.
- Preserve paragraph breaks (\\n) from the source.
- Do not add a translator's note, disclaimer, or any text about the translation itself.`;

export type ClientReportTranslateResult = {
  texts: TranslatableFieldMap;
  /** Atslēgas, kuras modelis izlaida vai atgrieza tukšas, lai gan avotā bija saturs — fallback uz LV notiek izsaucēja pusē. */
  missingKeys: string[];
};

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Tulko visus pasūtījuma brīvā teksta laukus vienā AI izsaukumā. Tukšs input = tukšs output, bez AI izsaukuma. */
export async function translateClientReportTexts(
  texts: TranslatableFieldMap,
  lang: ClientReportTargetLang,
  modelTier: AiAdminModelTier = "gemini-flash",
): Promise<ClientReportTranslateResult> {
  const entries = Object.entries(texts).filter(([, v]) => v.trim().length > 0);
  if (entries.length === 0) return { texts: {}, missingKeys: [] };

  const langName = lang === "en" ? "English" : lang === "de" ? "German" : "Russian";
  const source = Object.fromEntries(entries);

  const raw = await adminGenerateJsonText({
    modelTier,
    systemInstruction: REPORT_TRANSLATE_SYSTEM(langName),
    userPrompt: `Translate the values of this JSON object. Return JSON with identical keys.\n\n${JSON.stringify(source, null, 2)}`,
    temperature: 0.2,
  });

  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ai_invalid_json");
  }

  const record = parsed as Record<string, unknown>;
  const out: TranslatableFieldMap = {};
  const missingKeys: string[] = [];
  for (const [key] of entries) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) {
      out[key] = v;
    } else {
      missingKeys.push(key);
    }
  }
  return { texts: out, missingKeys };
}

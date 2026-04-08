import "server-only";

import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type GenerateContentResult,
} from "@google/generative-ai";

/**
 * Google Gemini (server only). `GEMINI_API_KEY` no `process.env`;
 * klienta komponenti izsauc tikai API maršrutus.
 */

/** Google Gemini — latviešu gramatikas / stila labošana (admin, ✨ `/api/admin/ai-polish-lv`). */
export const LV_POLISH_SYSTEM_PROMPT =
  "Tu esi latviešu valodas redaktors. Izlabo gramatikas un stila kļūdas šajā auto apskates atskaites tekstā, saglabājot profesionālu auto eksperta toni. Atgriez TIKAI laboto tekstu bez komentāriem.";

/** Sludinājuma iekopētais apraksts → pārdošanas konteksts eksperta atskaitei (admin). */
export const LV_LISTING_ANALYSIS_SYSTEM_PROMPT =
  "Tu esi auto tirgus un tehniskās atskaites asistents. Lietotājs iesniedz sludinājuma aprakstu (bieži neapkoptu, kopētu no portāla). Izveido īsu, profesionālu tekstu latviešu valodā laukam „Pārdošanas sludinājuma konteksts”: izcel galveno pārdošanas vēstījumu, būtiskās tehniskās norādes, cenu/ nobraukuma kontekstu (ja minēts), acīmredzamas pretrunas vai riskus. Saglabā objektīvu toni. Atgriez TIKAI gatavo tekstu bez ievada, kopsavilkuma virsraksta vai paskaidrojumiem par uzdevumu.";

const MAX_INPUT_CHARS = 48_000;

const GEMINI_MODEL = "gemini-1.5-flash";

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/** Viena `GoogleGenerativeAI` instance uz procesu — neveido jaunu katrā POST. */
let googleGenAiSingleton: GoogleGenerativeAI | null = null;

function getGoogleGenerativeAI(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("missing_gemini_key");
  }
  if (!googleGenAiSingleton) {
    googleGenAiSingleton = new GoogleGenerativeAI(key);
  }
  return googleGenAiSingleton;
}

let polishModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;
let listingAnalysisModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;

function getPolishGenerativeModel() {
  if (!polishModel) {
    polishModel = getGoogleGenerativeAI().getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: LV_POLISH_SYSTEM_PROMPT,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: { temperature: 0.2 },
    });
  }
  return polishModel;
}

function getListingAnalysisGenerativeModel() {
  if (!listingAnalysisModel) {
    listingAnalysisModel = getGoogleGenerativeAI().getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: LV_LISTING_ANALYSIS_SYSTEM_PROMPT,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: { temperature: 0.35 },
    });
  }
  return listingAnalysisModel;
}

/**
 * Tikai servera API maršrutiem. Atslēga: vienīgi `process.env.GEMINI_API_KEY`.
 */
export function getGeminiApiKeyFromEnv(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

function extractTextFromGenerateResult(result: GenerateContentResult): string {
  const raw = result.response.text();
  const out = typeof raw === "string" ? raw.trim() : "";
  if (!out) {
    throw new Error("gemini_empty_response");
  }
  return out;
}

export async function polishLatvianTextWithGemini(raw: string): Promise<string> {
  const text = raw.slice(0, MAX_INPUT_CHARS);
  const model = getPolishGenerativeModel();
  const result = await model.generateContent(text);
  return extractTextFromGenerateResult(result);
}

export async function analyzeListingPasteForSalesContextWithGemini(raw: string): Promise<string> {
  const text = raw.slice(0, MAX_INPUT_CHARS);
  const model = getListingAnalysisGenerativeModel();
  const result = await model.generateContent(text);
  return extractTextFromGenerateResult(result);
}

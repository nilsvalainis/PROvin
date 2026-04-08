import "server-only";

/**
 * Google Gemini (server only) — AI Studio Free Tier: `/v1beta/models/gemini-1.5-flash:generateContent`.
 * `GEMINI_API_KEY` no `process.env`; klienta komponenti izsauc tikai API maršrutus.
 */

/** Google Gemini — latviešu gramatikas / stila labošana (admin, ✨ `/api/admin/ai-polish-lv`). */
export const LV_POLISH_SYSTEM_PROMPT =
  "Tu esi latviešu valodas redaktors. Izlabo gramatikas un stila kļūdas šajā auto apskates atskaites tekstā, saglabājot profesionālu auto eksperta toni. Atgriez TIKAI laboto tekstu bez komentāriem.";

/** Sludinājuma iekopētais apraksts → pārdošanas konteksts eksperta atskaitei (admin). */
export const LV_LISTING_ANALYSIS_SYSTEM_PROMPT =
  "Tu esi auto tirgus un tehniskās atskaites asistents. Lietotājs iesniedz sludinājuma aprakstu (bieži neapkoptu, kopētu no portāla). Izveido īsu, profesionālu tekstu latviešu valodā laukam „Pārdošanas sludinājuma konteksts”: izcel galveno pārdošanas vēstījumu, būtiskās tehniskās norādes, cenu/ nobraukuma kontekstu (ja minēts), acīmredzamas pretrunas vai riskus. Saglabā objektīvu toni. Atgriez TIKAI gatavo tekstu bez ievada, kopsavilkuma virsraksta vai paskaidrojumiem par uzdevumu.";

const MAX_INPUT_CHARS = 48_000;

/**
 * v1beta REST ceļš: `/v1beta/models/{modelId}:generateContent` — viens `models/` segments.
 * Free Tier: noklusējums `gemini-1.5-flash` (bez `-001`).
 */
const DEFAULT_GEMINI_MODEL_ID = "gemini-1.5-flash";

function getGeminiModelIdForUrl(): string {
  const raw = process.env.GEMINI_MODEL?.trim();
  if (raw) {
    if (raw.length > 80 || !/^[a-zA-Z0-9._-]+$/.test(raw)) {
      return DEFAULT_GEMINI_MODEL_ID;
    }
    return raw;
  }
  return DEFAULT_GEMINI_MODEL_ID;
}

function geminiGenerateContentUrl(apiKey: string): string {
  const modelId = getGeminiModelIdForUrl();
  const q = encodeURIComponent(apiKey);
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${q}`;
}

type GeminiGenerateBody = {
  contents: { parts: { text: string }[] }[];
  generationConfig?: { temperature?: number };
};

function extractTextFromGeminiJson(json: unknown): string {
  if (!json || typeof json !== "object") throw new Error("gemini_invalid_json");
  const r = json as Record<string, unknown>;
  const candidates = r.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("gemini_empty_candidates");
  }
  const c0 = candidates[0] as Record<string, unknown>;
  const content = c0.content as Record<string, unknown> | undefined;
  const parts = content?.parts as unknown;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("gemini_empty_parts");
  }
  const p0 = parts[0] as Record<string, unknown>;
  const text = typeof p0.text === "string" ? p0.text.trim() : "";
  if (!text) throw new Error("gemini_empty_response");
  return text;
}

async function geminiGenerateContent(
  systemPrompt: string,
  userText: string,
  temperature: number,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("missing_gemini_key");
  }
  const text = userText.slice(0, MAX_INPUT_CHARS);
  const prompt = systemPrompt + text;
  const url = geminiGenerateContentUrl(key);
  const body: GeminiGenerateBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature },
  };

  console.log("Sūtu pieprasījumu uz Gemini Free Tier...");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.status !== 200) {
    const errBody = await response.text();
    throw new Error(errBody);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("gemini_invalid_response_body");
  }
  return extractTextFromGeminiJson(json);
}

/**
 * Tikai servera API maršrutiem. Atslēga: vienīgi `process.env.GEMINI_API_KEY`.
 */
export function getGeminiApiKeyFromEnv(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

export async function polishLatvianTextWithGemini(raw: string): Promise<string> {
  return geminiGenerateContent(LV_POLISH_SYSTEM_PROMPT, raw, 0.2);
}

export async function analyzeListingPasteForSalesContextWithGemini(raw: string): Promise<string> {
  return geminiGenerateContent(LV_LISTING_ANALYSIS_SYSTEM_PROMPT, raw, 0.35);
}

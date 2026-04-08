import "server-only";

/**
 * Google Gemini (server only). `GEMINI_API_KEY` lasa tikai šeit no `process.env`;
 * klienta komponenti nedrīkst izsaukt šī moduļa funkcijas — tikai `app/api/admin/*` maršruti.
 */

/** Google Gemini — latviešu gramatikas / stila labošana (admin, ✨ `/api/admin/ai-polish-lv`). */
export const LV_POLISH_SYSTEM_PROMPT =
  "Tu esi latviešu valodas redaktors. Izlabo gramatikas un stila kļūdas šajā auto apskates atskaites tekstā, saglabājot profesionālu auto eksperta toni. Atgriez TIKAI laboto tekstu bez komentāriem.";

/** Sludinājuma iekopētais apraksts → pārdošanas konteksts eksperta atskaitei (admin). */
export const LV_LISTING_ANALYSIS_SYSTEM_PROMPT =
  "Tu esi auto tirgus un tehniskās atskaites asistents. Lietotājs iesniedz sludinājuma aprakstu (bieži neapkoptu, kopētu no portāla). Izveido īsu, profesionālu tekstu latviešu valodā laukam „Pārdošanas sludinājuma konteksts”: izcel galveno pārdošanas vēstījumu, būtiskās tehniskās norādes, cenu/ nobraukuma kontekstu (ja minēts), acīmredzamas pretrunas vai riskus. Saglabā objektīvu toni. Atgriez TIKAI gatavo tekstu bez ievada, kopsavilkuma virsraksta vai paskaidrojumiem par uzdevumu.";

const MAX_INPUT_CHARS = 48_000;

const GEMINI_MODEL = "gemini-1.5-flash";

/** Samazina nevēlamus SAFETY bloķējumus tehniskajam / auto atskaišu tekstam (REST v1beta). */
const GEMINI_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
] as const;

/**
 * Tikai servera API maršrutiem. Atslēga: vienīgi `process.env.GEMINI_API_KEY`.
 * Lokāli: `.env.local` vai `.env` projekta saknē; pēc izmaiņām restartē `npm run dev`.
 */
export function getGeminiApiKeyFromEnv(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { code?: number; message?: string; status?: string };
};

function extractGeminiText(data: GeminiGenerateResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) return null;
  const chunks = parts.map((p) => p.text).filter((t): t is string => typeof t === "string");
  if (!chunks.length) return null;
  const out = chunks.join("").trim();
  return out || null;
}

async function geminiGenerateWithSystemPrompt(
  apiKey: string,
  systemPrompt: string,
  userText: string,
  temperature: number,
): Promise<string> {
  const text = userText.slice(0, MAX_INPUT_CHARS);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text }],
        },
      ],
      safetySettings: [...GEMINI_SAFETY_SETTINGS],
      generationConfig: {
        temperature,
      },
    }),
  });
  const rawBody = await res.text();
  let data: GeminiGenerateResponse;
  try {
    data = JSON.parse(rawBody) as GeminiGenerateResponse;
  } catch {
    throw new Error(`gemini_http_${res.status}:${rawBody.slice(0, 200)}`);
  }
  if (!res.ok) {
    const hint = data.error?.message ?? rawBody.slice(0, 200);
    throw new Error(`gemini_http_${res.status}:${hint}`);
  }
  const out = extractGeminiText(data);
  if (!out) {
    throw new Error("gemini_empty_response");
  }
  return out;
}

export async function polishLatvianTextWithGemini(raw: string, apiKey: string): Promise<string> {
  return geminiGenerateWithSystemPrompt(apiKey, LV_POLISH_SYSTEM_PROMPT, raw, 0.2);
}

export async function analyzeListingPasteForSalesContextWithGemini(raw: string, apiKey: string): Promise<string> {
  return geminiGenerateWithSystemPrompt(apiKey, LV_LISTING_ANALYSIS_SYSTEM_PROMPT, raw, 0.35);
}

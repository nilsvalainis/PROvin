import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

/** Dziļā analīze — pārdevējs (grounding), gala kopsavilkums. */
export const GEMINI_MODEL_PRO = "gemini-2.5-pro";
/** Ātrākas darbības — gramatika, avotu komentāri, ieteikumi, cena (Free Tier). */
export const GEMINI_MODEL_FLASH = "gemini-2.5-flash";

export function getGeminiApiKeyFromEnv(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

/** Izvelk lasāmu kļūdu no Google Generative AI SDK / fetch atbildes. */
export function formatGeminiSdkError(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message.trim();
    if (/404.*models\/gemini|is not found for API version/i.test(msg)) {
      return `Gemini modelis nav pieejams (${msg.match(/models\/[^\s:]+/)?.[0] ?? "model"}) — izmanto gemini-2.5-flash / gemini-2.5-pro`;
    }
    if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(msg)) {
      return "Gemini API kvota pārsniegta — uzgaidi vai pārbaudi Google AI Studio billing";
    }
    if (/API key not valid|API_KEY_INVALID|invalid.*api.?key/i.test(msg)) {
      return "Nederīga GEMINI_API_KEY";
    }
    return msg || "unknown";
  }
  return "unknown";
}

export type GeminiUserPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/** Strukturēta JSON atbilde (responseMimeType application/json). */
export async function geminiGenerateJsonText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  /** Papildus daļas (piem. inline PDF) pirms `userPrompt` teksta. */
  extraParts?: GeminiUserPart[];
}): Promise<string> {
  const parts: GeminiUserPart[] = [...(opts.extraParts ?? []), { text: opts.userPrompt }];
  return geminiGenerateJsonFromParts({
    model: opts.model,
    systemInstruction: opts.systemInstruction,
    parts,
    temperature: opts.temperature,
  });
}

export async function geminiGenerateJsonFromParts(opts: {
  model: string;
  systemInstruction: string;
  parts: GeminiUserPart[];
  temperature?: number;
}): Promise<string> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: opts.model,
      systemInstruction: opts.systemInstruction,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: opts.parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        responseMimeType: "application/json",
      },
    });
    const text = result.response.text()?.trim();
    if (!text) throw new Error("gemini_empty_content");
    return text;
  } catch (e) {
    throw new Error(formatGeminiSdkError(e));
  }
}

export async function geminiGenerateText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: opts.model,
      systemInstruction: opts.systemInstruction,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
      generationConfig: { temperature: opts.temperature ?? 0.35 },
    });
    const text = result.response.text()?.trim();
    if (!text) throw new Error("gemini_empty_content");
    return text;
  } catch (e) {
    throw new Error(formatGeminiSdkError(e));
  }
}

type GenerateContentApiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
};

/** Google Search Grounding — REST v1beta (gemini-2.5-pro u.c.). */
export async function geminiGenerateTextWithGoogleSearch(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(key)}`;
  const toolVariants: Record<string, unknown>[][] = [[{ google_search: {} }], [{ googleSearch: {} }]];

  let lastErr = "gemini_grounding_failed";
  for (const tools of toolVariants) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
        tools,
        generationConfig: { temperature: opts.temperature ?? 0.35 },
      }),
    });
    const raw = (await res.json()) as GenerateContentApiResponse;
    if (!res.ok) {
      lastErr = raw.error?.message?.trim() || `http_${res.status}`;
      continue;
    }
    const text = raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (text) return text;
    lastErr = "gemini_empty_content";
  }
  throw new Error(formatGeminiSdkError(new Error(lastErr)));
}

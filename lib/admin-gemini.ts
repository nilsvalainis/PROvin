import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

/** Pagaidām abas konstantes — flash (AI Studio Free Tier: 2.5-pro limits = 0). */
export const GEMINI_MODEL_PRO = "gemini-2.5-flash";
export const GEMINI_MODEL_FLASH = "gemini-2.5-flash";

export function getGeminiApiKeyFromEnv(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

export async function geminiGenerateText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

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
  throw new Error(lastErr);
}

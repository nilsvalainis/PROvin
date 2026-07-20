import "server-only";

import { GEMINI_MODEL_FLASH, geminiGenerateText } from "@/lib/admin-gemini";
import { GEMINI_LV_POLISH_SYSTEM } from "@/lib/admin-gemini-prompts";

/** Latviešu gramatikas labošana (admin ✨) — Gemini Flash (lēts / ātrs). */
export async function polishLatvianTextWithGemini(raw: string): Promise<string> {
  const text = raw.trim();
  if (!text) throw new Error("empty_text");
  return geminiGenerateText({
    model: GEMINI_MODEL_FLASH,
    systemInstruction: GEMINI_LV_POLISH_SYSTEM,
    userPrompt: text,
    temperature: 0.2,
  });
}

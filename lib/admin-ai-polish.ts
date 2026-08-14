import "server-only";

import { CLAUDE_MODEL_SONNET, aiGenerateText } from "@/lib/admin-ai";
import { AI_LV_POLISH_SYSTEM } from "@/lib/admin-ai-prompts";

/** Latviešu gramatikas labošana (admin ✨) — Claude Sonnet (lēts / ātrs). */
export async function polishLatvianTextWithAi(raw: string): Promise<string> {
  const text = raw.trim();
  if (!text) throw new Error("empty_text");
  return aiGenerateText({
    model: CLAUDE_MODEL_SONNET,
    systemInstruction: AI_LV_POLISH_SYSTEM,
    userPrompt: text,
    temperature: 0.2,
  });
}

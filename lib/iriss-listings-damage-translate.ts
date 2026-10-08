import "server-only";

import { adminGenerateTextWithVocabulary } from "@/lib/admin-ai-dispatch";

export async function translateListingDamageLv(raw: string): Promise<string> {
  const text = raw.trim().slice(0, 4000);
  if (!text) return "";
  const out = await adminGenerateTextWithVocabulary({
    modelTier: "gemini-flash",
    maxLen: 800,
    systemInstruction:
      "Tu tulko auto izsoles stāvokļa tekstu latviski. Tikai tulkojums, 1-4 teikumi. Bez cenām, bez ID, bez platformas, bez saitēm. Nemaini faktus. Bez em dash.",
    userPrompt: `Tulko latviski:\n\n${text}`,
  });
  return out.trim();
}

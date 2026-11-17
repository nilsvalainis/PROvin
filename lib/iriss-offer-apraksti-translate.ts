import "server-only";

import { adminGenerateTextWithVocabulary } from "@/lib/admin-ai-dispatch";

/**
 * Piedāvājuma Apraksti lauka tulkojums latviski. Vienmēr Gemini (modelTier "gemini-flash"),
 * nekad Opus/Sonnet - sk. lib/admin-ai-dispatch.ts::adminGenerateTextWithVocabulary, kur
 * šis tier nekad neeskalē uz Claude pat pašlabošanas atkārtojumos.
 */
export async function translateOfferAprakstiTextLv(raw: string): Promise<string> {
  const text = raw.trim().slice(0, 6000);
  if (!text) return "";
  const out = await adminGenerateTextWithVocabulary({
    modelTier: "gemini-flash",
    maxLen: 2000,
    systemInstruction:
      "Tu tulko transportlīdzekļa piedāvājuma apraksta tekstu latviski. Tikai tulkojums, saglabā struktūru (rindkopas, saraksti) un aptuveno garumu. Nemaini faktus, cenas, ID, platformu nosaukumus. Bez em dash.",
    userPrompt: `Tulko latviski:\n\n${text}`,
  });
  return out.trim();
}

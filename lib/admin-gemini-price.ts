import "server-only";

import { GEMINI_MODEL_FLASH, geminiGenerateText } from "@/lib/admin-gemini";
import { GEMINI_PRICE_ANALYSIS_SYSTEM } from "@/lib/admin-gemini-prompts";
import {
  buildGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import {
  fetchListingAiSnapshot,
  formatListingAiSnapshotForGemini,
} from "@/lib/listing-scrape";

export async function generatePriceAnalysisWithGemini(input: GeminiOrderContextInput): Promise<string> {
  const listingUrl = input.listingUrl?.trim() ?? "";
  const listingBlock = listingUrl
    ? formatListingAiSnapshotForGemini(await fetchListingAiSnapshot(listingUrl))
    : "";

  const context = buildGeminiOrderContextText(input);

  if (!context.trim() && !listingBlock.trim()) {
    throw new Error("empty_order_context");
  }

  if (listingUrl && listingBlock.includes("neizdevās nolasīt")) {
    throw new Error("listing_scrape_failed");
  }

  const userPrompt = `Pasūtījuma ID: ${input.sessionId}

${listingBlock ? `${listingBlock}\n\n---\n\n` : ""}${context}

Novērtē, vai šī auto cena ir adekvāta Latvijas lietotu auto tirgum (ss.lv līmenī). Izmanto augstāk norādīto ss.lv sludinājuma saturu (cena, gads, marka, nobraukums, apraksts u.c.) un pārējo pasūtījuma kontekstu. Sagatavo tekstu laukam „Cenas atbilstība”.`;

  return geminiGenerateText({
    model: GEMINI_MODEL_FLASH,
    systemInstruction: GEMINI_PRICE_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
}

import "server-only";

import { geminiGenerateJsonText, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import { GEMINI_TIRGUS_MARKET_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection } from "@/lib/admin-gemini-operator-notes";
import {
  buildGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { buildMarketAnalysisGeminiContext } from "@/lib/admin-market-gemini-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import type { TirgusFormFields } from "@/lib/admin-source-blocks";
import { normalizeProvinExpertGeminiComment } from "@/lib/source-summary-comment-format";

export type TirgusMarketGeminiResult = {
  listedForSale: string;
  listingCreated: string;
  priceDrop: string;
  comments: string;
};

function clipField(s: string, max: number): string {
  return s.trim().slice(0, max);
}

function parseTirgusMarketJson(raw: string): TirgusMarketGeminiResult {
  const payload = JSON.parse(raw) as Record<string, unknown>;
  return {
    listedForSale: clipField(typeof payload.listedForSale === "string" ? payload.listedForSale : "", 32),
    listingCreated: clipField(typeof payload.listingCreated === "string" ? payload.listingCreated : "", 64),
    priceDrop: clipField(typeof payload.priceDrop === "string" ? payload.priceDrop : "", 32),
    comments: normalizeProvinExpertGeminiComment(
      clipField(typeof payload.comments === "string" ? payload.comments : "", 4000),
      4000,
    ),
  };
}

export async function generateTirgusMarketWithGemini(
  input: GeminiOrderContextInput,
): Promise<TirgusMarketGeminiResult> {
  const orderContext = buildGeminiOrderContextText(input);
  const { text: marketContext, listingSnapshot } = await buildMarketAnalysisGeminiContext({
    listingUrl: input.listingUrl,
    sourceBlocks: input.sourceBlocks,
  });

  if (!orderContext.trim() && !marketContext.trim()) {
    throw new Error("empty_order_context");
  }

  const existingTirgus = input.sourceBlocks.tirgus;
  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${marketContext ? `${marketContext}\n\n---\n\n` : ""}${orderContext}

Sagatavo tirgus analīzi: aizpildi laukus „Auto pārdošanā (dienas)”, „Izveidots”, „Cenas kritums (euro)” un eksperta komentāru latviešu valodā.
Ja ss.lv datos ir dienas platformā — izmanto to listedForSale; ja ir cenu vēsture — aprēķini priceDrop kā starpību EUR (tikai skaitlis, bez € simbola).`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        [
          adminRichHtmlToPlainText(existingTirgus.comments).trim(),
          existingTirgus.listedForSale.trim() ? `Dienas: ${existingTirgus.listedForSale}` : "",
          existingTirgus.priceDrop.trim() ? `Kritums: ${existingTirgus.priceDrop}` : "",
        ]
          .filter(Boolean)
          .join("\n") ||
        undefined,
    },
  );

  const raw = await geminiGenerateJsonText({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: GEMINI_TIRGUS_MARKET_SYSTEM,
    userPrompt,
    temperature: 0.25,
  });

  let parsed = parseTirgusMarketJson(raw);

  if (!parsed.listedForSale && listingSnapshot?.ok && listingSnapshot.daysListed != null) {
    parsed = { ...parsed, listedForSale: String(listingSnapshot.daysListed) };
  }
  if (!parsed.listingCreated && listingSnapshot?.ok && listingSnapshot.postedDateRaw?.trim()) {
    parsed = { ...parsed, listingCreated: listingSnapshot.postedDateRaw.trim() };
  }

  if (!parsed.comments.trim()) {
    throw new Error("empty_tirgus_comment");
  }

  return parsed;
}

export function applyTirgusMarketGeminiResult(
  prev: TirgusFormFields,
  result: TirgusMarketGeminiResult,
  commentsHtml: string,
): TirgusFormFields {
  return {
    ...prev,
    listedForSale: result.listedForSale || prev.listedForSale,
    listingCreated: result.listingCreated || prev.listingCreated,
    priceDrop: result.priceDrop || prev.priceDrop,
    comments: commentsHtml,
  };
}

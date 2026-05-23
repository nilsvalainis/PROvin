import "server-only";

import { GEMINI_MODEL_PRO, geminiGenerateText } from "@/lib/admin-gemini";
import { GEMINI_SUMMARY_ANALYSIS_SYSTEM } from "@/lib/admin-gemini-prompts";
import {
  buildGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";

function expertSection(label: string, html: string): string {
  const t = adminRichHtmlToPlainText(html).trim();
  if (!t) return "";
  return `### ${label}\n${t}`;
}

export async function generateSummaryAnalysisWithGemini(input: GeminiOrderContextInput): Promise<string> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const sellerPortrait = blocks.listing_analysis.sellerPortrait;
  const inspectionPlan = input.inspectionPlan ?? "";
  const priceFit = input.priceFit ?? "";

  const sellerText = expertSection("Pārdevēja portrets", sellerPortrait);
  const inspectionText = expertSection("Ieteikumi klātienes apskatei", inspectionPlan);
  const priceText = expertSection("Cenas atbilstība", priceFit);

  const orderContext = buildGeminiOrderContextText({
    ...input,
    irissSummary: undefined,
    inspectionPlan: undefined,
    priceFit: undefined,
  });

  if (!sellerText && !inspectionText && !priceText && !orderContext.trim()) {
    throw new Error("missing_expert_sections");
  }

  const expertBundle = [sellerText, inspectionText, priceText].filter(Boolean).join("\n\n");

  const userPrompt = `Pasūtījuma ID: ${input.sessionId}

${orderContext ? `${orderContext}\n\n---\n\n` : ""}${
    expertBundle
      ? `Eksperta jau sagatavotās sadaļas (papildus konteksts, nevis vienīgais avots):\n\n${expertBundle}\n\n---\n\n`
      : ""
  }Sagatavo gala kopsavilkumu klientam laukam „2. Kopsavilkums”.
Sintezē VISU portfeļa kontekstu — avotu datus, tabulas, komentārus un eksperta sadaļas.`;

  return geminiGenerateText({
    model: GEMINI_MODEL_PRO,
    systemInstruction: GEMINI_SUMMARY_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
}

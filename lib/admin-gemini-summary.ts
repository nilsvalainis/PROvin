import "server-only";

import { geminiGenerateTextWithVocabulary, resolveGeminiAdminModel } from "@/lib/admin-gemini";
import { GEMINI_SUMMARY_ANALYSIS_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection } from "@/lib/admin-gemini-operator-notes";
import {
  buildGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { buildPreviouslyGeneratedSourceCommentsContext } from "@/lib/admin-source-comment-blocks";

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

  const sourceCommentsContext = buildPreviouslyGeneratedSourceCommentsContext(null, blocks).trim();

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}

${orderContext ? `${orderContext}\n\n---\n\n` : ""}${
      sourceCommentsContext
        ? `Esošie eksperta komentāri avotu sadaļās (obligāti sintezē, neatkārto vārds vārdā):\n\n${sourceCommentsContext}\n\n---\n\n`
        : ""
    }${
      expertBundle
        ? `Eksperta jau sagatavotās sadaļas (papildus konteksts, nevis vienīgais avots):\n\n${expertBundle}\n\n---\n\n`
        : ""
    }Sagatavo gala kopsavilkumu klientam laukam „2. Kopsavilkums”.
Sintezē VISU portfeļa kontekstu — avotu datus, tabulas, komentārus un eksperta sadaļas.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.irissSummary ?? "").trim() ||
        undefined,
    },
  );

  return geminiGenerateTextWithVocabulary({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: GEMINI_SUMMARY_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.35,
  });
}

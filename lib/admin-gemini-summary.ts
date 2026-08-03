import "server-only";

import {
  geminiGenerateTextWithGoogleSearch,
  resolveGeminiAdminModel,
} from "@/lib/admin-gemini";
import { GEMINI_SUMMARY_ANALYSIS_SYSTEM } from "@/lib/admin-gemini-prompts";
import { appendGeminiOperatorNotesSection, geminiMaxLenForOperatorNotes } from "@/lib/admin-gemini-operator-notes";
import {
  buildFullGeminiOrderContextText,
  type GeminiOrderContextInput,
} from "@/lib/admin-gemini-order-context";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { buildPreviouslyGeneratedSourceCommentsContext } from "@/lib/admin-source-comment-blocks";
import { ADMIN_TECHNICAL_RISKS_LABEL } from "@/lib/admin-workspace-field-labels";
import { normalizeProvinExpertGeminiComment } from "@/lib/source-summary-comment-format";

function expertSection(label: string, html: string): string {
  const t = adminRichHtmlToPlainText(html).trim();
  if (!t) return "";
  return `### ${label}\n${t}`;
}

export async function generateSummaryAnalysisWithGemini(input: GeminiOrderContextInput): Promise<string> {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const sellerPortrait = blocks.listing_analysis.sellerPortrait;
  const technicalRisks = input.technicalRiskAnalysis ?? "";
  const inspectionPlan = input.inspectionPlan ?? "";
  const priceFit = input.priceFit ?? "";

  const sellerText = expertSection("Pārdevēja portrets", sellerPortrait);
  const techText = expertSection(`1. ${ADMIN_TECHNICAL_RISKS_LABEL}`, technicalRisks);
  const inspectionText = expertSection("2. Ieteikumi klātienes apskatei", inspectionPlan);
  const priceText = expertSection("Cenas atbilstība", priceFit);

  const orderContext = await buildFullGeminiOrderContextText({
    ...input,
    irissSummary: undefined,
    inspectionPlan: undefined,
    technicalRiskAnalysis: undefined,
    priceFit: undefined,
  });

  if (!sellerText && !techText && !inspectionText && !priceText && !orderContext.trim()) {
    throw new Error("missing_expert_sections");
  }

  const expertBundle = [sellerText, techText, inspectionText, priceText].filter(Boolean).join("\n\n");

  const sourceCommentsContext = buildPreviouslyGeneratedSourceCommentsContext(null, blocks).trim();

  const makeModel = blocks.csdd.makeModel.trim();
  const fuel = blocks.csdd.fuelType.trim();
  const vehicleHint = [makeModel, fuel].filter(Boolean).join(", ");

  const userPrompt = appendGeminiOperatorNotesSection(
    `Pasūtījuma ID: ${input.sessionId}
${vehicleHint ? `Identificētais auto (CSDD): ${vehicleHint}` : ""}

${orderContext ? `${orderContext}\n\n---\n\n` : ""}${
      sourceCommentsContext
        ? `Esošie eksperta komentāri avotu sadaļās (TIKAI konteksts — NEATKĀRTO un neapkopo teikumus):\n\n${sourceCommentsContext}\n\n---\n\n`
        : ""
    }${
      expertBundle
        ? `Eksperta jau sagatavotās sadaļas (TIKAI konteksts — NEATKĀRTO detalizāciju):\n\n${expertBundle}\n\n---\n\n`
        : ""
    }Sagatavo gala kopsavilkumu klientam laukam „3. Kopsavilkums”.

Uzdevums: īss, skaidrs **profesionāls viedoklis** par datu **kopainu** + **rekomendācija**. Brīvā formā — nevis katra punkta atkārtošana.

KRITISKI:
- NEATKĀRTO un neapkopo jau ģenerētos teikumus no avotiem / nobraukuma / negadījumiem / „${ADMIN_TECHNICAL_RISKS_LABEL}” / apskates.
- Neveido „CSDD… AutoDNA… CarVertical…” katalogu.
- Tipiski 3–5 īsas rindkopas + APPROVED BY IRISS.
- NESĀC ar „Sveiki” vai sarunas uzrunu.
- Beigās: APPROVED BY IRISS.`,
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain:
        input.existingDraftPlain?.trim() ||
        adminRichHtmlToPlainText(input.irissSummary ?? "").trim() ||
        undefined,
    },
  );

  const raw = await geminiGenerateTextWithGoogleSearch({
    model: resolveGeminiAdminModel(input.modelTier),
    systemInstruction: GEMINI_SUMMARY_ANALYSIS_SYSTEM,
    userPrompt,
    temperature: 0.3,
  });
  return normalizeProvinExpertGeminiComment(
    raw,
    geminiMaxLenForOperatorNotes(input.operatorNotes, 2200),
  );
}

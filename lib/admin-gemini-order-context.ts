import "server-only";

import {
  autoRecordsBlockToPlainText,
  citiAvotiToPlainText,
  csddFormToPlainText,
  listingAnalysisToPlainText,
  ltabBlockToPlainText,
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  standardBlockToPlainText,
  tirgusFormToPlainText,
  vendorAvotuBlockToPlainText,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";

export type GeminiOrderContextInput = {
  sessionId: string;
  vin: string | null;
  listingUrl: string | null;
  customerName: string | null;
  notes: string | null;
  sourceBlocks: WorkspaceSourceBlocks;
  /** Eksperta jau sagatavotais saturs (konteksts, ne pārrakstīšanai). */
  irissSummary?: string;
  inspectionPlan?: string;
  priceFit?: string;
  extraSellerName?: string;
};

function block(label: string, body: string): string {
  const t = body.trim();
  if (!t) return "";
  return `### ${label}\n${t}`;
}

/** Visi pieejamie pasūtījuma dati vienā prompta kontekstā. */
export function buildGeminiOrderContextText(input: GeminiOrderContextInput): string {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const parts: string[] = [];

  parts.push(
    block(
      "Pasūtījums",
      [
        input.vin ? `VIN: ${input.vin}` : "",
        input.listingUrl ? `Sludinājuma saite: ${input.listingUrl}` : "",
        input.customerName ? `Klienta vārds: ${input.customerName}` : "",
        input.notes ? `Klienta piezīmes: ${input.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  );

  if (input.extraSellerName?.trim()) {
    parts.push(block("Papildus pārdevēja nosaukums", input.extraSellerName.trim()));
  }

  const sourceSections: { key: keyof WorkspaceSourceBlocks; text: string }[] = [
    { key: "csdd", text: csddFormToPlainText(blocks.csdd) },
    { key: "autodna", text: vendorAvotuBlockToPlainText(blocks.autodna) },
    { key: "carvertical", text: vendorAvotuBlockToPlainText(blocks.carvertical) },
    { key: "auto_records", text: autoRecordsBlockToPlainText(blocks.auto_records) },
    { key: "ltab", text: ltabBlockToPlainText(blocks.ltab) },
    { key: "tirgus", text: tirgusFormToPlainText(blocks.tirgus) },
    { key: "citi_avoti", text: citiAvotiToPlainText(blocks.citi_avoti) },
    { key: "listing_analysis", text: listingAnalysisToPlainText(blocks.listing_analysis) },
  ];

  for (const { key, text } of sourceSections) {
    let sectionText = text;
    if (key === "listing_analysis") {
      const paste = blocks.listing_analysis.listingPasteRaw.trim();
      if (paste) {
        sectionText = sectionText
          ? `${sectionText}\n\nSludinājuma apraksts (iekopēts, nav PDF):\n${paste}`
          : `Sludinājuma apraksts (iekopēts, nav PDF):\n${paste}`;
      }
    }
    const section = block(SOURCE_BLOCK_LABELS[key], sectionText);
    if (section) parts.push(section);
  }

  const expertParts = [
    input.irissSummary?.trim()
      ? block("Eksperta kopsavilkums (melnraksts)", adminRichHtmlToPlainText(input.irissSummary))
      : "",
    input.inspectionPlan?.trim()
      ? block("Eksperta ieteikumi apskatei (melnraksts)", adminRichHtmlToPlainText(input.inspectionPlan))
      : "",
    input.priceFit?.trim()
      ? block("Cenas atbilstība (melnraksts)", adminRichHtmlToPlainText(input.priceFit))
      : "",
  ].filter(Boolean);

  if (expertParts.length > 0) {
    parts.push(block("Eksperta bloks (konteksts)", expertParts.join("\n\n")));
  }

  return parts.filter(Boolean).join("\n\n");
}

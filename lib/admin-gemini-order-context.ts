import "server-only";

import {
  autoRecordsBlockToPlainText,
  citiAvotiSectionLabel,
  citiAvotiToPlainText,
  CSDD_MILEAGE_UNIFIED_TITLE,
  csddFormToPlainText,
  listingAnalysisToPlainText,
  ltabBlockToPlainText,
  ltabRowHasData,
  mergeSourceBlocksWithDefaults,
  NEGADIJUMU_VESTURE_TITLE,
  SOURCE_BLOCK_LABELS,
  tirgusFormToPlainText,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  vendorAvotuBlockToPlainText,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import {
  ADMIN_INCIDENTS_SUMMARY_LABEL,
  ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
  ADMIN_SOURCES_COMPARISON_LABEL,
} from "@/lib/admin-workspace-field-labels";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import { collectUnifiedMileageRows } from "@/lib/unified-mileage";

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
  /** NEGADĪJUMU VĒSTURES KOPSAVILKUMS (iekšējais). */
  internalComment?: string;
  /** NOBRAUKUMA VĒSTURES KOMENTĀRS. */
  mileageComment?: string;
  /** AVOTU SALĪDZINĀJUMS — iekšējs, nav PDF. */
  sourcesComparisonComment?: string;
  operatorNotes?: string;
  existingDraftPlain?: string;
};

function block(label: string, body: string): string {
  const t = body.trim();
  if (!t) return "";
  return `### ${label}\n${t}`;
}

function unifiedMileagePlainText(blocks: WorkspaceSourceBlocks): string {
  const rows = collectUnifiedMileageRows({
    csddForm: blocks.csdd,
    autoRecordsBlock: blocks.auto_records,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    citiAvotiBlock: blocks.citi_avoti,
  });
  if (rows.length === 0) return "";
  const lines = rows.map((r) => [r.date, r.odometer, r.country, r.sourceLabel].join("\t"));
  return [CSDD_MILEAGE_UNIFIED_TITLE, ...lines].join("\n");
}

function unifiedIncidentsWithLossPlainText(blocks: WorkspaceSourceBlocks): string {
  const rows = collectUnifiedIncidentRows({
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    manualLtabBlock: toPdfLtabManualBlock(blocks.ltab),
  });
  if (rows.length === 0) return "";
  const lines = rows.map((r) => [r.date, r.lossAmount, r.country, r.sourceLabel].join("\t"));
  return [`Apvienotā ${NEGADIJUMU_VESTURE_TITLE} (ar zaudējumu summu)`, ...lines].join("\n");
}

function allIncidentRowsPlainText(blocks: WorkspaceSourceBlocks): string {
  const parts: string[] = [];
  for (const key of ["autodna", "carvertical"] as const) {
    const inc = blocks[key].incidents.filter(ltabRowHasData);
    if (inc.length === 0) continue;
    parts.push(`【${SOURCE_BLOCK_LABELS[key]} — ${NEGADIJUMU_VESTURE_TITLE}】`);
    for (const r of inc) {
      parts.push([r.csngDate.trim(), r.lossAmount.trim(), r.incidentNo.trim()].filter(Boolean).join("\t"));
    }
  }
  const citiTotal = blocks.citi_avoti.sections.length;
  for (const [i, section] of blocks.citi_avoti.sections.entries()) {
    const inc = section.incidents.filter(ltabRowHasData);
    if (inc.length === 0) continue;
    const head = citiAvotiSectionLabel(section, i, citiTotal);
    parts.push(`【${head} — ${NEGADIJUMU_VESTURE_TITLE}】`);
    for (const r of inc) {
      parts.push([r.csngDate.trim(), r.lossAmount.trim(), r.incidentNo.trim()].filter(Boolean).join("\t"));
    }
  }
  const ltabInc = blocks.ltab.rows.filter(ltabRowHasData);
  if (ltabInc.length > 0) {
    parts.push(`【${SOURCE_BLOCK_LABELS.ltab} — ${NEGADIJUMU_VESTURE_TITLE}】`);
    for (const r of ltabInc) {
      parts.push([r.csngDate.trim(), r.lossAmount.trim(), r.incidentNo.trim()].filter(Boolean).join("\t"));
    }
  }
  return parts.join("\n");
}

function vendorRawLogsPlainText(blocks: WorkspaceSourceBlocks): string {
  const parts: string[] = [];
  for (const key of ["autodna", "carvertical"] as const) {
    const raw = blocks[key].mileagePasteRaw?.trim();
    if (!raw) continue;
    parts.push(`【${SOURCE_BLOCK_LABELS[key]} raw logs】\n${raw.slice(0, 12_000)}`);
  }
  const citiTotal = blocks.citi_avoti.sections.length;
  for (const [i, section] of blocks.citi_avoti.sections.entries()) {
    const raw = section.rawUnprocessedData?.trim();
    if (!raw) continue;
    const head = citiAvotiSectionLabel(section, i, citiTotal);
    parts.push(`【${head} — RAW datu žurnāls】\n${raw.slice(0, 12_000)}`);
  }
  return parts.join("\n\n");
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

  const crossSource = [
    block("Apvienotais nobraukums (visi avoti)", unifiedMileagePlainText(blocks)),
    block("Visi negadījumu ieraksti (visi avoti)", allIncidentRowsPlainText(blocks)),
    block("Apvienotie negadījumi ar zaudējumu summu", unifiedIncidentsWithLossPlainText(blocks)),
    block("Vendor raw logs", vendorRawLogsPlainText(blocks)),
  ].filter(Boolean);
  if (crossSource.length > 0) parts.push(crossSource.join("\n\n"));

  const expertParts = [
    input.inspectionPlan?.trim()
      ? block("Eksperta ieteikumi apskatei (melnraksts)", adminRichHtmlToPlainText(input.inspectionPlan))
      : "",
    input.priceFit?.trim()
      ? block("Cenas atbilstība (melnraksts)", adminRichHtmlToPlainText(input.priceFit))
      : "",
    input.irissSummary?.trim()
      ? block("Eksperta kopsavilkums (melnraksts)", adminRichHtmlToPlainText(input.irissSummary))
      : "",
    input.internalComment?.trim()
      ? block(ADMIN_INCIDENTS_SUMMARY_LABEL, adminRichHtmlToPlainText(input.internalComment))
      : "",
    input.mileageComment?.trim()
      ? block(ADMIN_MILEAGE_HISTORY_COMMENT_LABEL, adminRichHtmlToPlainText(input.mileageComment))
      : "",
    input.sourcesComparisonComment?.trim()
      ? block(ADMIN_SOURCES_COMPARISON_LABEL, adminRichHtmlToPlainText(input.sourcesComparisonComment))
      : "",
  ].filter(Boolean);

  if (expertParts.length > 0) {
    parts.push(block("Eksperta piezīmes un melnraksti", expertParts.join("\n\n")));
  }

  return parts.filter(Boolean).join("\n\n");
}

import "server-only";

import { createHash } from "node:crypto";
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
  vinRegistryIncidentRowHasData,
  SOURCE_BLOCK_LABELS,
  tirgusFormToPlainText,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  vendorAvotuBlockToPlainText,
  vinRegistryBlockToPlainText,
  oneautoBlockToPlainText,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { OFFICIAL_DEALER_SECTION_TITLE } from "@/lib/oneauto-dealer";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { appendAiContextRawSection } from "@/lib/admin-ai-context-raw";
import { buildPreviouslyGeneratedSourceCommentsContext } from "@/lib/admin-source-comment-blocks";
import {
  ADMIN_INCIDENTS_SUMMARY_LABEL,
  ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
  ADMIN_SOURCES_COMPARISON_LABEL,
  ADMIN_TECHNICAL_RISKS_LABEL,
} from "@/lib/admin-workspace-field-labels";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import type { AiTextStream } from "@/lib/ai-text-stream";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import { collectUnifiedMileageRows } from "@/lib/unified-mileage";
import {
  formatOwnerCountAiContext,
  synthesizeOwnerCountsFromBlocks,
} from "@/lib/owner-count-synthesis";
import { buildHistoricalReportsAiContext } from "@/lib/admin-ai-historical-context";
import { buildAggregateKnowledgeAiContext } from "@/lib/admin-ai-aggregate-knowledge";
import { buildStyleCorpusAiContext } from "@/lib/admin-ai-style-corpus";
import { buildTechnicalInspectionCoverageBrief } from "@/lib/admin-ai-ta-coverage";
import { buildWinterSaltRustBrief } from "@/lib/admin-ai-winter-salt-rust";

export type AiOrderContextInput = {
  sessionId: string;
  vin: string | null;
  listingUrl: string | null;
  customerName: string | null;
  notes: string | null;
  sourceBlocks: WorkspaceSourceBlocks;
  /** Eksperta jau sagatavotais saturs (konteksts, ne pārrakstīšanai). */
  irissSummary?: string;
  inspectionPlan?: string;
  /** 1. Tehnisko risku analīze. */
  technicalRiskAnalysis?: string;
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
  /** Pro (noklusējums) vai Flash — admin ✨ pogas izvēle. */
  modelTier?: AiAdminModelTier;
  /** Dzīvais teksta priekšskatījums admin UI (SSE); nav gala teksts. */
  stream?: AiTextStream;
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
    oneautoBlock: blocks.oneauto,
    ccVinBlock: blocks.cc_vin,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    citiAvotiBlock: blocks.citi_avoti,
    tirgusForm: blocks.tirgus,
  });
  if (rows.length === 0) return "";
  const lines = rows.map((r) => [r.date, r.odometer, r.country, r.sourceLabel].join("\t"));
  return [CSDD_MILEAGE_UNIFIED_TITLE, ...lines].join("\n");
}

function unifiedIncidentsWithLossPlainText(blocks: WorkspaceSourceBlocks): string {
  const rows = collectUnifiedIncidentRows({
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    manualLtabBlock: toPdfLtabManualBlock(blocks.ltab),
    ccVinBlock: blocks.cc_vin,
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
  for (const key of ["tjekbil", "mnt_ee", "lkf_ee", "carinfo"] as const) {
    const inc = (blocks[key].incidents ?? []).filter(vinRegistryIncidentRowHasData);
    if (inc.length === 0) continue;
    parts.push(`【${SOURCE_BLOCK_LABELS[key]} — ${NEGADIJUMU_VESTURE_TITLE}】`);
    for (const r of inc) {
      parts.push([r.date.trim(), r.amount.trim(), r.country.trim(), r.note.trim()].filter(Boolean).join("\t"));
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

/** Visi jau aizpildītie eksperta komentāri — stila reference ✨ ģenerēšanai. */
export function buildFinishedReportStyleReferenceSection(input: {
  sourceBlocks: WorkspaceSourceBlocks;
  irissSummary?: string;
  inspectionPlan?: string;
  technicalRiskAnalysis?: string;
  priceFit?: string;
  internalComment?: string;
  mileageComment?: string;
}): string {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const parts: string[] = [];

  const sourceComments = buildPreviouslyGeneratedSourceCommentsContext(null, blocks).trim();
  if (sourceComments) parts.push(sourceComments);

  const expertFields: Array<[string, string | undefined]> = [
    [ADMIN_MILEAGE_HISTORY_COMMENT_LABEL, input.mileageComment],
    [ADMIN_INCIDENTS_SUMMARY_LABEL, input.internalComment],
    ["Cenas atbilstība", input.priceFit],
    [ADMIN_TECHNICAL_RISKS_LABEL, input.technicalRiskAnalysis],
    ["2. Ieteikumi klātienes apskatei", input.inspectionPlan],
    ["3. Kopsavilkums", input.irissSummary],
  ];
  for (const [label, html] of expertFields) {
    const plain = adminRichHtmlToPlainText(html ?? "").trim();
    if (!plain) continue;
    parts.push(`### ${label}\n${plain}`);
  }

  if (parts.length === 0) return "";
  return `### Gatavo PROVIN audita komentāru stila reference (ŠĪ pasūtījuma jau uzrakstītie lauki — atdarini ritmu, BET pielāgo AKTĪVAJAM laukam, šī audita datiem un OPERATORA KOMANDĀM; nekopē rindkopas un neaizstāj operatora tēmas)
${parts.join("\n\n")}`;
}

/** „Papildu AI konteksts” — visiem blokiem, izņemot Citi avoti (tur tas ir katrai sekcijai). */
function blockAiContextRaw(blocks: WorkspaceSourceBlocks, key: keyof WorkspaceSourceBlocks): string {
  if (key === "citi_avoti") return "";
  const b = blocks[key] as { aiContextRaw?: string };
  return b.aiContextRaw ?? "";
}

/** Visi pieejamie pasūtījuma dati vienā prompta kontekstā. */
export function buildAiOrderContextText(input: AiOrderContextInput): string {
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

  const sourceSections: { key: keyof WorkspaceSourceBlocks; text: string; label?: string }[] = [
    { key: "csdd", text: csddFormToPlainText(blocks.csdd) },
    { key: "autodna", text: vendorAvotuBlockToPlainText(blocks.autodna) },
    { key: "carvertical", text: vendorAvotuBlockToPlainText(blocks.carvertical) },
    { key: "auto_records", text: autoRecordsBlockToPlainText(blocks.auto_records) },
    { key: "oneauto", text: oneautoBlockToPlainText(blocks.oneauto), label: OFFICIAL_DEALER_SECTION_TITLE },
    { key: "tjekbil", text: vinRegistryBlockToPlainText(blocks.tjekbil) },
    { key: "mnt_ee", text: vinRegistryBlockToPlainText(blocks.mnt_ee) },
    { key: "lkf_ee", text: vinRegistryBlockToPlainText(blocks.lkf_ee) },
    { key: "carinfo", text: vinRegistryBlockToPlainText(blocks.carinfo) },
    { key: "ltab", text: ltabBlockToPlainText(blocks.ltab) },
    { key: "tirgus", text: tirgusFormToPlainText(blocks.tirgus) },
    { key: "citi_avoti", text: citiAvotiToPlainText(blocks.citi_avoti) },
    { key: "listing_analysis", text: listingAnalysisToPlainText(blocks.listing_analysis) },
  ];

  for (const { key, text, label } of sourceSections) {
    let sectionText = text;
    if (key === "listing_analysis") {
      const paste = blocks.listing_analysis.listingPasteRaw.trim();
      if (paste) {
        sectionText = sectionText
          ? `${sectionText}\n\nSludinājuma apraksts (iekopēts, nav PDF):\n${paste}`
          : `Sludinājuma apraksts (iekopēts, nav PDF):\n${paste}`;
      }
    }
    sectionText = appendAiContextRawSection(sectionText, blockAiContextRaw(blocks, key));
    const section = block(label ?? SOURCE_BLOCK_LABELS[key], sectionText);
    if (section) parts.push(section);
  }

  const ownerCountContext = formatOwnerCountAiContext(synthesizeOwnerCountsFromBlocks(blocks));
  const crossSource = [
    block("Īpašnieku skaits (reconcilēts — neskaitīt avotus kopā)", ownerCountContext),
    block("Apvienotais nobraukums (visi avoti)", unifiedMileagePlainText(blocks)),
    block("Visi negadījumu ieraksti (visi avoti)", allIncidentRowsPlainText(blocks)),
    block("Apvienotie negadījumi ar zaudējumu summu", unifiedIncidentsWithLossPlainText(blocks)),
    block("Vendor raw logs", vendorRawLogsPlainText(blocks)),
  ].filter(Boolean);
  if (crossSource.length > 0) parts.push(crossSource.join("\n\n"));

  const expertParts = [
    input.technicalRiskAnalysis?.trim()
      ? block(`Eksperta ${ADMIN_TECHNICAL_RISKS_LABEL} (melnraksts)`, adminRichHtmlToPlainText(input.technicalRiskAnalysis))
      : "",
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

  const styleReference = buildFinishedReportStyleReferenceSection({
    sourceBlocks: blocks,
    irissSummary: input.irissSummary,
    inspectionPlan: input.inspectionPlan,
    technicalRiskAnalysis: input.technicalRiskAnalysis,
    priceFit: input.priceFit,
    internalComment: input.internalComment,
    mileageComment: input.mileageComment,
  });
  if (styleReference) parts.push(styleReference);

  const taCoverage = buildTechnicalInspectionCoverageBrief({
    csdd: blocks.csdd,
    sourceBlocks: blocks,
  });
  if (taCoverage) parts.push(taCoverage);

  const winterSalt = buildWinterSaltRustBrief({
    csdd: blocks.csdd,
    sourceBlocks: blocks,
    extraHaystack: [input.notes, input.operatorNotes].filter(Boolean).join("\n"),
  });
  if (winterSalt) parts.push(winterSalt);

  return parts.filter(Boolean).join("\n\n");
}

const ORDER_CONTEXT_CACHE_TTL_MS = 60_000;
const orderContextCache = new Map<string, { text: string; expiresAt: number }>();

function orderContextCacheKey(input: AiOrderContextInput): string {
  const payload = {
    sessionId: input.sessionId,
    vin: input.vin,
    listingUrl: input.listingUrl,
    customerName: input.customerName,
    notes: input.notes,
    sourceBlocks: input.sourceBlocks,
    irissSummary: input.irissSummary,
    inspectionPlan: input.inspectionPlan,
    technicalRiskAnalysis: input.technicalRiskAnalysis,
    priceFit: input.priceFit,
    extraSellerName: input.extraSellerName,
    internalComment: input.internalComment,
    mileageComment: input.mileageComment,
    sourcesComparisonComment: input.sourcesComparisonComment,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** Notīra konteksta kešu (tests / pēc masveida draft izmaiņām). */
export function invalidateAiOrderContextCache(): void {
  orderContextCache.clear();
}

/** Pilns pasūtījuma + vēsturisko auditu konteksts ✨ ģenerēšanai (īss TTL kešs). */
export async function buildFullAiOrderContextText(input: AiOrderContextInput): Promise<string> {
  const cacheKey = orderContextCacheKey(input);
  const hit = orderContextCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.text;

  const base = buildAiOrderContextText(input);
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const historical = await buildHistoricalReportsAiContext({
    sessionId: input.sessionId,
    sourceBlocks: blocks,
    vin: input.vin,
  });
  const aggregateKnowledge = await buildAggregateKnowledgeAiContext({
    sourceBlocks: blocks,
    vin: input.vin,
  });
  const styleCorpus = buildStyleCorpusAiContext();
  const sections = [base, styleCorpus, historical, aggregateKnowledge].filter((s) => s.trim());
  const text = sections.join("\n\n");
  orderContextCache.set(cacheKey, { text, expiresAt: Date.now() + ORDER_CONTEXT_CACHE_TTL_MS });
  return text;
}

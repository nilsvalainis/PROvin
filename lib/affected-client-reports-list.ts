import "server-only";

import { listAllDashboardDraftIndexEntries } from "@/lib/admin-dashboard-draft-index";
import { readOrderDraft, getOrderDraftBlobConfig } from "@/lib/admin-order-draft-store";
import {
  hydrateWorkspaceFromStorage,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
} from "@/lib/admin-source-blocks";
import {
  clientReportScanIsAffected,
  isClientReportAtOrAfterPr277Cutoff,
  PR277_CLIENT_REPORT_CUTOFF_ISO,
  scanClientReportText,
  type ClientReportIncidentScan,
} from "@/lib/affected-client-reports";
import { readClientReportPdf } from "@/lib/partner-client-report-storage";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";
import { detectTotalLossFromPdfInput } from "@/lib/total-loss-detect";
import {
  aggregateUnifiedIncidents,
  collectUnifiedIncidentRows,
} from "@/lib/unified-incidents";

export type AffectedClientReportRow = {
  orderId: string;
  vin: string | null;
  clientEmail: string | null;
  pdfGeneratedAt: string | null;
  pdfFound: boolean;
  scanSource: "pdf" | "draft" | "index-only";
  hasIncidentSection: boolean | null;
  hasAveragedAmounts: boolean | null;
  hasPilnigsZaudejums: boolean | null;
  affected: boolean | null;
  notes: string[];
};

export type AffectedClientReportsReport = {
  cutoffIso: string;
  blobConfigured: boolean;
  listedCount: number;
  scannedPdfCount: number;
  scannedDraftCount: number;
  affectedCount: number;
  unknownScanCount: number;
  rows: AffectedClientReportRow[];
};

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const core = (await import("pdf-parse/lib/pdf-parse.js")) as {
    default?: (data: Buffer) => Promise<{ text?: unknown }>;
  };
  const pdfParse = core.default;
  if (typeof pdfParse !== "function") return "";
  const result = await pdfParse(Buffer.from(bytes));
  return typeof result.text === "string" ? result.text : "";
}

function scanFromDraftWorkspace(draft: NonNullable<Awaited<ReturnType<typeof readOrderDraft>>>): {
  scan: ClientReportIncidentScan;
  notes: string[];
} {
  const notes: string[] = [];
  const hydrated = draft.workspace ? hydrateWorkspaceFromStorage(JSON.stringify(draft.workspace)) : null;
  if (!hydrated?.sourceBlocks) {
    return {
      scan: {
        hasTildeApprox: false,
        hasPilnigsZaudejums: false,
        hasBannedAveragedAmounts: false,
        hasIncidentSection: false,
        hasAveragedIncidentDisplay: false,
      },
      notes: ["draft_has_no_workspace"],
    };
  }
  const blocks = hydrated.sourceBlocks;
  const summaryInput = {
    csddForm: blocks.csdd,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    manualLtabBlock: toPdfLtabManualBlock(blocks.ltab),
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
  };
  const tiles = buildPdfReportSummaryTiles(summaryInput);
  const incidents = tiles.find((t) => t.id === "incidents");
  const tileBlob = `${incidents?.value ?? ""} ${incidents?.note ?? ""}`;
  const agg = aggregateUnifiedIncidents(collectUnifiedIncidentRows(summaryInput));
  const amountBlob = agg.clusters
    .flatMap((c) => [c.displayAmount, ...c.sourceValuations.map((s) => s.displayAmount)])
    .join(" ");
  const loss = detectTotalLossFromPdfInput(summaryInput);
  const hay = `${tileBlob}\n${amountBlob}`;
  const scan = scanClientReportText(hay);
  if (loss.found) {
    scan.hasPilnigsZaudejums = true;
    notes.push("draft_detectTotalLoss_found");
  }
  if (agg.clusters.some((c) => c.averaged)) {
    scan.hasAveragedIncidentDisplay = true;
    notes.push("draft_cluster_averaged");
  }
  if (agg.uniqueCount > 0) scan.hasIncidentSection = true;
  return { scan, notes };
}

export async function listAffectedClientReports(opts?: {
  scanPdf?: boolean;
  scanDraft?: boolean;
}): Promise<AffectedClientReportsReport> {
  const scanPdf = opts?.scanPdf !== false;
  const scanDraft = opts?.scanDraft !== false;
  const entries = await listAllDashboardDraftIndexEntries();
  const blobConfigured = Boolean(getOrderDraftBlobConfig());
  const rows: AffectedClientReportRow[] = [];
  let scannedPdfCount = 0;
  let scannedDraftCount = 0;

  for (const entry of entries) {
    if (!isClientReportAtOrAfterPr277Cutoff(entry.clientReportReadyAt)) continue;
    const row: AffectedClientReportRow = {
      orderId: entry.sessionId,
      vin: entry.vin,
      clientEmail: entry.customerEmail,
      pdfGeneratedAt: entry.clientReportReadyAt,
      pdfFound: false,
      scanSource: "index-only",
      hasIncidentSection: null,
      hasAveragedAmounts: null,
      hasPilnigsZaudejums: null,
      affected: null,
      notes: [],
    };

    if (scanPdf) {
      try {
        const pdf = await readClientReportPdf(entry.sessionId);
        if (pdf && pdf.byteLength > 0) {
          row.pdfFound = true;
          const text = await extractPdfText(pdf);
          const scan = scanClientReportText(text);
          row.scanSource = "pdf";
          row.hasIncidentSection = scan.hasIncidentSection;
          row.hasAveragedAmounts = scan.hasAveragedIncidentDisplay;
          row.hasPilnigsZaudejums = scan.hasPilnigsZaudejums;
          row.affected = clientReportScanIsAffected(scan);
          scannedPdfCount += 1;
        } else {
          row.notes.push("pdf_not_in_blob_or_disk");
        }
      } catch (err) {
        row.notes.push(`pdf_scan_failed:${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (row.scanSource === "index-only" && scanDraft) {
      try {
        const draft = await readOrderDraft(entry.sessionId);
        if (draft) {
          if (!row.vin) row.vin = draft.orderEdits.vin?.trim() || row.vin;
          if (!row.clientEmail) row.clientEmail = draft.orderEdits.customerEmail?.trim() || row.clientEmail;
          const { scan, notes } = scanFromDraftWorkspace(draft);
          row.scanSource = "draft";
          row.hasIncidentSection = scan.hasIncidentSection;
          row.hasAveragedAmounts = scan.hasAveragedIncidentDisplay;
          row.hasPilnigsZaudejums = scan.hasPilnigsZaudejums;
          row.affected = clientReportScanIsAffected(scan);
          row.notes.push("draft_is_current_workspace_not_stored_pdf", ...notes);
          scannedDraftCount += 1;
        } else {
          row.notes.push("draft_not_found");
        }
      } catch (err) {
        row.notes.push(`draft_scan_failed:${err instanceof Error ? err.message : String(err)}`);
      }
    }

    rows.push(row);
  }

  rows.sort((a, b) => String(b.pdfGeneratedAt).localeCompare(String(a.pdfGeneratedAt)));
  return {
    cutoffIso: PR277_CLIENT_REPORT_CUTOFF_ISO,
    blobConfigured,
    listedCount: rows.length,
    scannedPdfCount,
    scannedDraftCount,
    affectedCount: rows.filter((r) => r.affected === true).length,
    unknownScanCount: rows.filter((r) => r.affected == null).length,
    rows,
  };
}

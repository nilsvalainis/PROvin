"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";
import { AdminSavablePortfolioFileRow } from "@/components/admin/AdminSavablePortfolioFileRow";
import { AdminCsddSourceBlock } from "@/components/admin/AdminCsddSourceBlock";
import { AdminLtabSourceBlock } from "@/components/admin/AdminLtabSourceBlock";
import { AdminAutoRecordsSourceBlock } from "@/components/admin/AdminAutoRecordsSourceBlock";
import { AdminVendorAvotuSourceBlock } from "@/components/admin/AdminVendorAvotuSourceBlock";
import { AdminTirgusSourceBlock } from "@/components/admin/AdminTirgusSourceBlock";
import { AdminListingAnalysisSourceBlock } from "@/components/admin/AdminListingAnalysisSourceBlock";
import { AdminCitiAvotiSourceBlock } from "@/components/admin/AdminCitiAvotiSourceBlock";
import {
  SOURCE_BLOCK_KEYS,
  SOURCE_BLOCK_LABELS,
  SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS,
  blocksToLegacyFlatFields,
  citiAvotiToPlainText,
  createDefaultSourceBlocks,
  csddFormToPlainText,
  emptyCitiAvotiSection,
  emptyVendorAvotuBlock,
  hydrateWorkspaceFromStorage,
  listingAnalysisToPlainText,
  ltabBlockToPlainText,
  LISTING_HISTORY_SUBSECTION_TITLE,
  mergeSourceBlocksWithDefaults,
  autoRecordsBlockToPlainText,
  standardBlockToPlainText,
  vendorAvotuBlockToPlainText,
  tirgusFormToPlainText,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type SourceBlockKey,
  type ListingAnalysisBlockState,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { syncListingAnalysisPhotoGroupsAndFlat } from "@/lib/listing-analysis-photo-types";
import {
  idbDeletePortfolio,
  idbGetPortfolio,
  idbSetPortfolio,
  migrateLegacyPortfolioFromLocalStorage,
  type StoredPortfolioBlob,
} from "@/lib/admin-portfolio-idb";
import {
  coalesceOrderWorkspacePersistBody,
  isRegressiveWorkspacePersist,
  normalizeOrderWorkspacePersistBody,
  serializeOrderWorkspaceSnapshotFromRef,
  workspaceHydrationFillScore,
  type OrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";
import { resolveOrderWorkspaceHydration } from "@/lib/admin-order-workspace-hydrate";
import {
  bumpWorkspaceSaveGeneration,
  persistWorkspaceState,
} from "@/lib/admin-workspace-persist-client";
import { workspaceDebugLog } from "@/lib/admin-workspace-debug-log";
import { usePathname } from "next/navigation";
import {
  analyzeVinAndKm,
  segmentTextForPreview,
  stripListingFluff,
  type PreviewSegment,
  type SegmentOptions,
} from "@/lib/admin-workspace-preview-format";
import {
  analyzePdfBuffer,
  mergeKmForChart,
  type PdfPortfolioFileInsight,
} from "@/lib/admin-portfolio-pdf-analysis";
import { buildClientReportDocumentHtml } from "@/lib/client-report-html";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import { mergePdfVisibility, type PdfVisibilitySettings } from "@/lib/pdf-visibility";
import {
  ListingAnalysisMainBlockTitleRow,
  ListingAnalysisSubsectionHeading,
} from "@/components/admin/AdminListingAnalysisSectionChrome";
import { AdminProvinAlertBanners } from "@/components/admin/AdminProvinAlertBanners";
import {
  computeProvinAlertBannersFromWorkspace,
  computeProvinInfoBannersFromWorkspace,
  mergeProvinBannerPdfInclude,
  type ProvinBannerKind,
  type ProvinBannerPdfInclude,
} from "@/lib/provin-alert-banners";
import { IRISS_CHROME_LUCIDE, LISTING_ANALYSIS_CHROME_LUCIDE } from "@/lib/admin-lucide-registry";
import {
  TRAFFIC_HEADER_STRIP_CLASS,
  autoRecordsTrafficLevel,
  citiAvotiTrafficLevel,
  csddTrafficLevel,
  expertSummaryTrafficLevel,
  listingSectionTrafficLevel,
  ltabTrafficLevel,
  type TrafficFillLevel,
  vendorAvotuTrafficLevel,
} from "@/lib/admin-block-traffic-status";
import type { ListingMarketSnapshot } from "@/lib/listing-scrape";
import {
  CarFront,
  Check,
  ClipboardList,
  LayoutDashboard,
  Layers,
  Link2,
  ListChecks,
  Loader2,
  MessageSquare,
  Newspaper,
  Scale,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AdminAiPolishRichCommentShell } from "@/components/admin/AdminAiPolishRichCommentShell";
import { AdminGeminiGenerateWithPrefill } from "@/components/admin/AdminGeminiGenerateWithPrefill";
import type { AdminGeminiSourceCommentSlot } from "@/components/admin/AdminSourceCommentField";
import {
  applySourceBlockGeneratedComment,
  citiAvotiSectionPlainTextExcludingComments,
  isMainAnalysisSourceBlock,
  sourceBlockCommentsPlainForGemini,
  type GeminiSourceCommentBlockKey,
  sourceBlockHasDataExcludingComments,
} from "@/lib/admin-source-comment-blocks";
import { AdminVinCopyButton } from "@/components/admin/AdminVinClipboardAndLinks";
import { normalizeWhatsAppPhoneDigits, openWhatsAppChat } from "@/lib/admin-whatsapp-phone";
import {
  AdminCommonPhrasesDrawer,
  AdminCommonPhrasesDrawerTrigger,
} from "@/components/admin/AdminCommonPhrasesDrawer";
import { workspaceWizardProgressPct } from "@/lib/admin-workspace-progress";
import { geminiPlainTextToRichHtml, adminRichHtmlToPlainText, geminiExpertSourceCommentToRichHtml } from "@/lib/admin-rich-comment-html";
import {
  ADMIN_INCIDENTS_SUMMARY_LABEL,
  ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
  ADMIN_SOURCES_COMPARISON_LABEL,
} from "@/lib/admin-workspace-field-labels";
import {
  orderHasIncidentDataForGemini,
  orderHasMileageDataForGemini,
  orderHasSourceDataForGemini,
} from "@/lib/admin-gemini-data-availability";
import { buildProvinAuditPdfFilename } from "@/lib/audit-report-pdf-filename";
import { NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES } from "@/lib/notify-report-email-limits";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import {
  isNotifyBlobUploadEnabled,
  postNotifyReportReadyMultipart,
  postNotifyReportReadyViaBlob,
  type NotifyPortfolioUploadItem,
} from "@/lib/admin-notify-report-ready-client";
import { formatAdminGeminiFetchError, parseAdminGeminiResponse } from "@/lib/admin-gemini-client-errors";
import type { GeminiAdminModelTier } from "@/lib/gemini-admin-model-tier";
import { AdminPersistenceHealthBanner } from "@/components/admin/AdminPersistenceHealthBanner";
import type { VehicleAIExtraction, VehicleAiExtractionMeta } from "@/lib/vehicle-ai-extraction-types";

function geminiFetchErrorMessage(
  res: Response,
  data: { error?: string; detail?: string },
  parseFailed: boolean,
  fallback: string,
): string {
  if (parseFailed) return `Gemini: servera atbilde nav lasāma (HTTP ${res.status})`;
  return formatAdminGeminiFetchError(data, res, fallback);
}

export type OrderWorkspacePayload = {
  sessionId: string;
  isDemo: boolean;
  /** Vai Gemini pogas drīkst strādāt (pēc noklusējuma visiem pasūtījumiem). */
  geminiAllowed: boolean;
  vin: string | null;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: string;
  listingUrl: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  contactMethod: string | null;
  notes: string | null;
  serverInternalComment: string | null;
  serverAttachments: { label: string; fileName: string }[];
};

type PortfolioEntry = {
  id: string;
  name: string;
  size: number;
  mime: string;
  addedAt: string;
  blobUrl: string;
};

type WorkspacePersist = {
  sourceBlocks: WorkspaceSourceBlocks;
  iriss: string;
  /** §7 PDF — personalizēts apskates plāns klātienē. */
  apskatesPlāns: string;
  cenasAtbilstiba: string;
  previewConfirmed: boolean;
  vehicleAiExtraction: VehicleAIExtraction | null;
  vehicleAiExtractionMeta: VehicleAiExtractionMeta | null;
};

const EMPTY_WORKSPACE: WorkspacePersist = {
  sourceBlocks: createDefaultSourceBlocks(),
  iriss: "",
  apskatesPlāns: "",
  cenasAtbilstiba: "",
  previewConfirmed: false,
  vehicleAiExtraction: null,
  vehicleAiExtractionMeta: null,
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;

/** Pielikumu kolonnā pēc noklusējuma redzams pirmā fails; pārējie — modālā. */
const PORTFOLIO_INLINE_VISIBLE_MAX = 1;

const ADMIN_CONTENT_MAX = "max-w-[min(76.8rem,calc(100vw-1.25rem))]";

const workspaceToolbarBtn =
  "rounded-md border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2 py-1 text-[11px] font-semibold tracking-tight text-[var(--color-apple-text)] shadow-sm transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

const wizardFooterBtnBase =
  "inline-flex h-9 min-w-[7.25rem] shrink-0 items-center justify-center rounded-lg px-3 py-2 text-[11px] font-semibold tracking-tight transition disabled:cursor-not-allowed disabled:opacity-40";
const wizardFooterNav = `${wizardFooterBtnBase} border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700`;
const wizardFooterPreview = `${wizardFooterBtnBase} border border-amber-600/35 bg-[#FFD700] text-amber-950 shadow-sm hover:bg-[#ffe033]`;
const wizardFooterPdf = `${wizardFooterBtnBase} border border-emerald-800/40 bg-[#22C55E] text-white shadow-sm hover:bg-[#16a34a]`;

const workspaceSectionTitle = `font-medium uppercase tracking-wide text-[var(--color-provin-muted)] ${SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS}`;

const workspaceSectionShell =
  "rounded-xl bg-[var(--admin-surface-elevated)] p-2 shadow-sm ring-1 ring-[var(--admin-border-subtle)]";

const WHATSAPP_PREFILL_MESSAGE = `Sveiki!

Nosūtu Jums iegādāto PROVIN auditu. Visus papildu materiālus nosūtīju uz Jūsu e-pastu.

⚠️ Svarīgi: Sakarā ar tehniskiem uzlabojumiem, e-pasts dažkārt mēdz nonākt Spam mapē. Lūdzu, pārbaudiet!

Ja rodas jautājumi par atskaites datiem, ir nepieciešams padoms pirms/pēc auto apskates vai palīdzība pie formalitāšu kārtošanas — droši rakstiet šeit vai zvaniet. Labprāt palīdzēšu!

Ar cieņu,
IRISS (Nils V.)`;

function wrapPdfTextLine(text: string, maxWidth: number, widthOfText: (value: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const out: string[] = [];
  let line = words[0] ?? "";
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${line} ${words[i]}`;
    if (widthOfText(candidate) <= maxWidth) {
      line = candidate;
    } else {
      out.push(line);
      line = words[i] ?? "";
    }
  }
  out.push(line);
  return out.map((x) => (x.length > 1200 ? `${x.slice(0, 1200)}…` : x));
}

/**
 * WhatsApp ātrajam PDF izmantojam WinAnsi drošu tekstu (pdf-lib StandardFonts).
 * Tas novērš kļūdu: WinAnsi cannot encode "ā" u.c.
 */
function toWinAnsiSafeText(text: string): string {
  return text
    .replace(/[Āā]/g, "a")
    .replace(/[Čč]/g, "c")
    .replace(/[Ēē]/g, "e")
    .replace(/[Ģģ]/g, "g")
    .replace(/[Īī]/g, "i")
    .replace(/[Ķķ]/g, "k")
    .replace(/[Ļļ]/g, "l")
    .replace(/[Ņņ]/g, "n")
    .replace(/[Šš]/g, "s")
    .replace(/[Ūū]/g, "u")
    .replace(/[Žž]/g, "z")
    .replace(/[“”„]/g, "\"")
    .replace(/[’]/g, "'")
    .replace(/[–—]/g, "-");
}

function WhatsAppIconGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
      <path
        fill="currentColor"
        d="M19.11 4.89A9.91 9.91 0 0 0 12.06 2a9.99 9.99 0 0 0-8.57 15.14L2 22l5-1.31A10 10 0 1 0 19.11 4.89ZM12.06 20a7.9 7.9 0 0 1-4.03-1.1l-.29-.17-2.96.78.8-2.88-.19-.3A8 8 0 1 1 12.06 20Zm4.4-5.97c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.18-.7-.62-1.17-1.39-1.3-1.63-.14-.24-.01-.37.1-.49.1-.1.24-.26.36-.39.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.33.98 2.49c.12.16 1.68 2.56 4.06 3.59.57.24 1.01.39 1.36.5.57.18 1.09.16 1.5.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

const WIZARD_STEP_DOT: Record<TrafficFillLevel, string> = {
  empty: "bg-zinc-400",
  partial: "bg-amber-400",
  complete: "bg-emerald-500",
};

const WIZARD_STEP_COUNT = 8;

function dashboardWizardTrafficLevel(p: OrderWorkspacePayload): TrafficFillLevel {
  const vin = (p.vin ?? "").trim();
  const listing = (p.listingUrl ?? "").trim();
  const email = (p.customerEmail ?? "").trim();
  if (vin && listing && email) return "complete";
  if (vin || listing || email) return "partial";
  return "empty";
}

function worstTrafficLevel(a: TrafficFillLevel, b: TrafficFillLevel): TrafficFillLevel {
  const order: Record<TrafficFillLevel, number> = { empty: 0, partial: 1, complete: 2 };
  return order[a] <= order[b] ? a : b;
}

function storageKeyWorkspace(sessionId: string) {
  return `provin-admin-workspace-v3-${sessionId}`;
}

function storageKeyWorkspaceBackup(sessionId: string) {
  return `provin-admin-workspace-backup-v1-${sessionId}`;
}

const LEGACY_WORKSPACE_V2_PREFIX = "provin-admin-workspace-v2-";
const WORKSPACE_BACKUP_LIMIT = 20;
/** Blob rezerve — localStorage katru reizi; serveris debounce (nav katras rakstzīmes). */
const WORKSPACE_SERVER_AUTOSAVE_MS = 3500;

/** Vecais viena lauka komentārs */
function storageKeyInternalLegacy(sessionId: string) {
  return `provin-admin-internal-v1-${sessionId}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function orderSourceBlockPlainText(key: SourceBlockKey, blocks: WorkspaceSourceBlocks): string {
  switch (key) {
    case "csdd":
      return csddFormToPlainText(blocks.csdd);
    case "ltab":
      return ltabBlockToPlainText(blocks.ltab);
    case "tirgus":
      return tirgusFormToPlainText(blocks.tirgus);
    case "citi_avoti":
      return citiAvotiToPlainText(blocks.citi_avoti);
    case "listing_analysis":
      return listingAnalysisToPlainText(blocks.listing_analysis);
    case "auto_records":
      return autoRecordsBlockToPlainText(blocks.auto_records);
    case "autodna":
    case "carvertical":
      return vendorAvotuBlockToPlainText(blocks[key] ?? null);
  }
}

function workspaceToPersistBody(ws: WorkspacePersist): OrderWorkspacePersistBody {
  return {
    sourceBlocks: ws.sourceBlocks,
    iriss: ws.iriss,
    apskatesPlāns: ws.apskatesPlāns,
    cenasAtbilstiba: ws.cenasAtbilstiba,
    previewConfirmed: ws.previewConfirmed,
    vehicleAiExtraction: ws.vehicleAiExtraction,
    vehicleAiExtractionMeta: ws.vehicleAiExtractionMeta,
  };
}

function serializeWorkspaceState(
  ws: WorkspacePersist,
  pdf: PdfVisibilitySettings,
  bannerInclude: ProvinBannerPdfInclude,
  savedAt?: string,
): string {
  return serializeOrderWorkspaceSnapshotFromRef(
    workspaceToPersistBody(ws),
    pdf,
    bannerInclude,
    savedAt,
  );
}

const NOTIFY_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function fileMimeForPortfolio(p: PortfolioEntry, blob: Blob): string {
  const fromEntry = (p.mime ?? "").trim().toLowerCase();
  if (NOTIFY_ALLOWED_MIME.has(fromEntry)) return fromEntry;
  const n = p.name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  const bt = (blob.type || "").trim().toLowerCase();
  return NOTIFY_ALLOWED_MIME.has(bt) ? bt : "application/octet-stream";
}

function PreviewSegmentView({
  seg,
  showTirgusPriceHistoryHeader,
}: {
  seg: PreviewSegment;
  showTirgusPriceHistoryHeader?: boolean;
}) {
  if (seg.type === "subheading") {
    return (
      <h4 className="mt-3 border-b border-slate-100 pb-1 text-xs font-semibold tracking-wide text-[var(--color-provin-accent)] first:mt-0">
        {seg.title}
      </h4>
    );
  }
  if (seg.type === "kv") {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200/90">
        <table className="w-full min-w-[280px] border-collapse text-left text-xs">
          <tbody>
            {seg.rows.map(([k, v], ri) => (
              <tr key={ri} className="border-b border-slate-100 last:border-0">
                <td className="w-[38%] max-w-[44%] whitespace-pre-wrap bg-slate-50/90 px-2.5 py-1.5 font-medium text-[var(--color-apple-text)] align-top">
                  {k}
                </td>
                <td className="whitespace-pre-wrap px-2.5 py-1.5 text-[var(--color-provin-muted)] align-top">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (seg.type === "grid") {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200/90">
        <table className="w-full min-w-[280px] border-collapse text-left text-xs">
          {showTirgusPriceHistoryHeader && seg.rows[0]?.length === 3 ? (
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/95 text-[10px] font-bold uppercase tracking-wide text-[var(--color-provin-muted)]">
                <th className="px-2.5 py-2 text-left font-semibold">Datums</th>
                <th className="px-2.5 py-2 text-left font-semibold">Cena</th>
                <th className="px-2.5 py-2 text-left font-semibold">Nobraukums</th>
              </tr>
            </thead>
          ) : null}
          <tbody>
            {seg.rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-100 last:border-0">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="whitespace-pre-wrap px-2.5 py-1.5 text-[var(--color-provin-muted)] align-top first:bg-slate-50/90 first:font-medium first:text-[var(--color-apple-text)]"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <pre className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2 text-xs leading-relaxed text-[var(--color-provin-muted)]">
      {seg.lines.join("\n")}
    </pre>
  );
}

/** Priekšskata saturs bez virsraksta (virsrakstu dod saraksta elements). */
function PreviewWorkspaceBody({
  text,
  variant = "default",
}: {
  text: string;
  variant?: SegmentOptions["variant"];
}) {
  const trimmed = text.trim();
  if (!trimmed) {
    return <p className="mt-1 text-sm italic text-slate-500">Informācija nav pieejama</p>;
  }
  const segments = segmentTextForPreview(text, { variant });
  const firstTirgusHistoryGridIdx =
    variant === "tirgus"
      ? segments.findIndex((s) => s.type === "grid" && s.rows[0]?.length === 3)
      : -1;
  return (
    <div className="mt-2 space-y-3">
      {segments.length === 0 ? (
        <pre className="whitespace-pre-wrap text-sm text-[var(--color-provin-muted)]">{stripListingFluff(trimmed)}</pre>
      ) : (
        segments.map((seg, idx) => (
          <PreviewSegmentView
            key={idx}
            seg={seg}
            showTirgusPriceHistoryHeader={idx === firstTirgusHistoryGridIdx}
          />
        ))
      )}
    </div>
  );
}

function KmMergeChart({ points }: { points: { km: number; label: string }[] }) {
  if (points.length < 2) return null;
  const w = 520;
  const h = 168;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const kms = points.map((p) => p.km);
  const minK = Math.min(...kms);
  const maxK = Math.max(...kms);
  const span = Math.max(maxK - minK, 1);
  const coords = points.map((p, i) => {
    const x = padL + (i / Math.max(points.length - 1, 1)) * innerW;
    const y = padT + innerH - ((p.km - minK) / span) * innerH;
    return { x, y, ...p };
  });
  const poly = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-medium text-[var(--color-provin-muted)]">
        Nobraukuma paraugi no PDF (secība: paraugu kārta pēc apstrādes; nav laika asses)
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 w-full max-w-xl text-[var(--color-provin-accent)]" aria-hidden>
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#d4d4d8" strokeWidth="1" />
        <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" points={poly} />
        <text x={padL} y={h - 6} fontSize="9" fill="#71717a">
          min {minK.toLocaleString("lv-LV")} km — max {maxK.toLocaleString("lv-LV")} km
        </text>
      </svg>
    </div>
  );
}

export function OrderDetailWorkspace({
  payload,
  adminDark,
  internalCommentDraft,
  onInternalCommentChange,
  mileageCommentDraft,
  onMileageCommentChange,
  sourcesComparisonCommentDraft,
  onSourcesComparisonCommentChange,
  onOrderEditsPatch,
  dashboardSlot,
  portfolioPortalDomId,
  portfolioPortalTargetInParent = false,
  serverWorkspaceJson = null,
  orderDraftPersistenceEnabled = false,
  pdfVisibility,
  onPdfVisibilityChange,
  alertsPortalDomId,
  autodnaApiConfigured = false,
}: {
  payload: OrderWorkspacePayload;
  adminDark: boolean;
  internalCommentDraft: string;
  onInternalCommentChange: (value: string) => void;
  mileageCommentDraft: string;
  onMileageCommentChange: (value: string) => void;
  sourcesComparisonCommentDraft: string;
  onSourcesComparisonCommentChange: (value: string) => void;
  /** VIN un citi meta lauki no AI importa. */
  onOrderEditsPatch?: (patch: { vin?: string }) => void;
  /** 0. solis — maksājums, transports, klients, pielikumi, komentārs (vecāka 2×2 režģis). */
  dashboardSlot?: ReactNode;
  /** Ja norādīts, „1. Pielikumi” tiek renderēts šajā DOM elementā (kreisās kolonnas augšā). */
  portfolioPortalDomId?: string;
  /** Ja `true`, vecāka komponents jau renderē `<div id={portfolioPortalDomId} />` (bez dublikāta ID). */
  portfolioPortalTargetInParent?: boolean;
  /** SSR ielādēts darba zonas JSON (prioritāte pār localStorage). */
  serverWorkspaceJson?: string | null;
  orderDraftPersistenceEnabled?: boolean;
  pdfVisibility: PdfVisibilitySettings;
  onPdfVisibilityChange: (patch: Partial<PdfVisibilitySettings>) => void;
  /** Brīdinājumu bloks virs „Maksājums” (vecākā kolonnā). */
  alertsPortalDomId?: string;
  /** Vai serverī ir konfigurēts autoDNA sandbox API (AUTODNA_* env). */
  autodnaApiConfigured?: boolean;
}) {
  const fileInputId = useId();
  const [ws, setWs] = useState<WorkspacePersist>(EMPTY_WORKSPACE);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [workspaceSaveFlash, setWorkspaceSaveFlash] = useState(false);
  const [workspaceSaveServerOk, setWorkspaceSaveServerOk] = useState(true);
  const [workspaceSaveBusy, setWorkspaceSaveBusy] = useState(false);
  const [workspaceAutosaveStatus, setWorkspaceAutosaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [portfolio, setPortfolio] = useState<PortfolioEntry[]>([]);
  const portfolioRef = useRef<PortfolioEntry[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfInsights, setPdfInsights] = useState<PdfPortfolioFileInsight[]>([]);
  const [pdfScanning, setPdfScanning] = useState(false);
  const [pdfScanError, setPdfScanError] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const [vinBarCopyFlash, setVinBarCopyFlash] = useState(false);
  const [portfolioPortalEl, setPortfolioPortalEl] = useState<HTMLElement | null>(null);
  const [alertsPortalEl, setAlertsPortalEl] = useState<HTMLElement | null>(null);
  const [portfolioAllFilesModalOpen, setPortfolioAllFilesModalOpen] = useState(false);
  const [portfolioPersistFlash, setPortfolioPersistFlash] = useState(false);
  const [portfolioUploadNotice, setPortfolioUploadNotice] = useState<string | null>(null);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifyPhase, setNotifyPhase] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [notifyErr, setNotifyErr] = useState<string | null>(null);
  const [notifyLastSentTo, setNotifyLastSentTo] = useState<string | null>(null);
  const [geminiInspectionBusy, setGeminiInspectionBusy] = useState(false);
  const [geminiInspectionErr, setGeminiInspectionErr] = useState<string | null>(null);
  const [geminiPriceBusy, setGeminiPriceBusy] = useState(false);
  const [geminiTirgusMarketBusy, setGeminiTirgusMarketBusy] = useState(false);
  const [geminiTirgusMarketErr, setGeminiTirgusMarketErr] = useState<string | null>(null);
  const [geminiPriceErr, setGeminiPriceErr] = useState<string | null>(null);
  const [geminiSummaryBusy, setGeminiSummaryBusy] = useState(false);
  const [geminiSummaryErr, setGeminiSummaryErr] = useState<string | null>(null);
  const [geminiIncidentsSummaryBusy, setGeminiIncidentsSummaryBusy] = useState(false);
  const [geminiIncidentsSummaryErr, setGeminiIncidentsSummaryErr] = useState<string | null>(null);
  const [geminiMileageCommentBusy, setGeminiMileageCommentBusy] = useState(false);
  const [geminiMileageCommentErr, setGeminiMileageCommentErr] = useState<string | null>(null);
  const [geminiSourcesComparisonBusy, setGeminiSourcesComparisonBusy] = useState(false);
  const [geminiSourcesComparisonErr, setGeminiSourcesComparisonErr] = useState<string | null>(null);
  const [geminiSourceCommentBusy, setGeminiSourceCommentBusy] = useState<GeminiSourceCommentBlockKey | null>(null);
  const [geminiSourceCommentErr, setGeminiSourceCommentErr] = useState<{
    key: GeminiSourceCommentBlockKey;
    msg: string;
  } | null>(null);
  const notifyReportPdfExtraRef = useRef<HTMLInputElement>(null);
  const [portfolioDropActive, setPortfolioDropActive] = useState(false);
  const [prepareDraftBusy, setPrepareDraftBusy] = useState(false);
  const [prepareDraftPhase, setPrepareDraftPhase] = useState<string | null>(null);
  const [prepareDraftErr, setPrepareDraftErr] = useState<string | null>(null);
  const [prepareDraftNotice, setPrepareDraftNotice] = useState<string | null>(null);
  const portfolioDragDepth = useRef(0);
  const hydrationSnapshotRef = useRef("");
  const workspaceDirtyRef = useRef(false);
  const workspaceHydratedOnceRef = useRef(false);
  const workspaceServerSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceServerSaveGenRef = useRef(0);
  const lastGoodPersistBodyRef = useRef<OrderWorkspacePersistBody | null>(null);
  const workspaceRevisionRef = useRef(0);
  const wsPersistRef = useRef(ws);
  const wsStateRef = useRef(ws);
  wsStateRef.current = ws;
  const orderEditsRef = useRef({
    internal: internalCommentDraft,
    mileage: mileageCommentDraft,
    sourcesComparison: sourcesComparisonCommentDraft,
  });
  orderEditsRef.current = {
    internal: internalCommentDraft,
    mileage: mileageCommentDraft,
    sourcesComparison: sourcesComparisonCommentDraft,
  };
  const pdfVisibilityRef = useRef(pdfVisibility);
  pdfVisibilityRef.current = pdfVisibility;
  const [pdfBannerInclude, setPdfBannerInclude] = useState<ProvinBannerPdfInclude>({});
  const pdfBannerIncludeRef = useRef(pdfBannerInclude);
  pdfBannerIncludeRef.current = pdfBannerInclude;
  const portfolioBytes = useMemo(() => portfolio.reduce((a, p) => a + p.size, 0), [portfolio]);

  /** Sanitizēti bloki — jāaprēķina pirms jebkuras plain-text / VIN / km heuristikas. */
  const blocksDisplaySafe = useMemo(
    () => mergeSourceBlocksWithDefaults(ws.sourceBlocks as unknown),
    [ws.sourceBlocks],
  );

  const narrowPortfolioLayout = Boolean(portfolioPortalDomId);

  useLayoutEffect(() => {
    if (!portfolioPortalDomId || typeof document === "undefined") {
      setPortfolioPortalEl(null);
      return;
    }
    setPortfolioPortalEl(document.getElementById(portfolioPortalDomId));
  }, [portfolioPortalDomId, payload.sessionId]);

  useLayoutEffect(() => {
    if (!alertsPortalDomId || typeof document === "undefined") {
      setAlertsPortalEl(null);
      return;
    }
    setAlertsPortalEl(document.getElementById(alertsPortalDomId));
  }, [alertsPortalDomId, payload.sessionId]);

  useEffect(() => {
    if (!portfolioAllFilesModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPortfolioAllFilesModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [portfolioAllFilesModalOpen]);

  useEffect(() => {
    if (portfolio.length <= PORTFOLIO_INLINE_VISIBLE_MAX) setPortfolioAllFilesModalOpen(false);
  }, [portfolio.length]);

  const mergedKmPoints = useMemo(() => mergeKmForChart(pdfInsights), [pdfInsights]);

  const previewAnalysis = useMemo(() => {
    try {
      return analyzeVinAndKm({
        orderVin: payload.vin,
        blocks: SOURCE_BLOCK_KEYS.map((key) => ({
          label: SOURCE_BLOCK_LABELS[key],
          text: orderSourceBlockPlainText(key, blocksDisplaySafe),
        })),
        fileNames: portfolio.map((p) => p.name),
      });
    } catch {
      return { vins: [], vinIssues: [], kmByBlock: [], kmIssues: [] };
    }
  }, [payload.vin, blocksDisplaySafe, portfolio]);

  const pushWorkspaceBackup = useCallback(
    (snapshot: string) => {
      try {
        const key = storageKeyWorkspaceBackup(payload.sessionId);
        const raw = localStorage.getItem(key);
        const prev = raw ? (JSON.parse(raw) as { savedAt: string; data: string }[]) : [];
        if (Array.isArray(prev) && prev[0]?.data === snapshot) return;
        const next = [{ savedAt: new Date().toISOString(), data: snapshot }, ...(Array.isArray(prev) ? prev : [])].slice(
          0,
          WORKSPACE_BACKUP_LIMIT,
        );
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* quota */
      }
    },
    [payload.sessionId],
  );

  const syncWsPersistRefFromState = useCallback(() => {
    wsPersistRef.current = wsStateRef.current;
  }, []);

  const commitWorkspaceLocalNow = useCallback(
    (opts?: { force?: boolean }) => {
      if (!opts?.force && !workspaceHydrated) return;
      syncWsPersistRefFromState();
      const normalized = normalizeOrderWorkspacePersistBody(workspaceToPersistBody(wsPersistRef.current));
      lastGoodPersistBodyRef.current = normalized;
      const snapshot = serializeOrderWorkspaceSnapshotFromRef(
        normalized,
        pdfVisibilityRef.current,
        pdfBannerIncludeRef.current,
        new Date().toISOString(),
      );
      try {
        localStorage.setItem(storageKeyWorkspace(payload.sessionId), snapshot);
        const leg = localStorage.getItem(storageKeyInternalLegacy(payload.sessionId));
        if (leg) localStorage.removeItem(storageKeyInternalLegacy(payload.sessionId));
      } catch {
        return;
      }
      pushWorkspaceBackup(snapshot);
      hydrationSnapshotRef.current = snapshot;
    },
    [payload.sessionId, pushWorkspaceBackup, syncWsPersistRefFromState, workspaceHydrated],
  );

  /** Sinhrons `localStorage` — navigācijas / link klikšķa brīdī (bez gaidīšanas uz React unmount). */
  const flushWorkspaceLocalStorageSync = useCallback(() => {
    syncWsPersistRefFromState();
    commitWorkspaceLocalNow({ force: true });
  }, [commitWorkspaceLocalNow, syncWsPersistRefFromState]);

  const applyPersistBodyToWs = useCallback((merged: OrderWorkspacePersistBody): WorkspacePersist => {
    const normalized = normalizeOrderWorkspacePersistBody(merged);
    const next: WorkspacePersist = {
      sourceBlocks: normalized.sourceBlocks,
      iriss: normalized.iriss,
      apskatesPlāns: normalized.apskatesPlāns,
      cenasAtbilstiba: normalized.cenasAtbilstiba,
      previewConfirmed: normalized.previewConfirmed,
      vehicleAiExtraction: normalized.vehicleAiExtraction,
      vehicleAiExtractionMeta: normalized.vehicleAiExtractionMeta,
    };
    wsPersistRef.current = next;
    lastGoodPersistBodyRef.current = normalized;
    return next;
  }, []);

  const updateWs = useCallback(
    (patch: Partial<WorkspacePersist>) => {
      workspaceDirtyRef.current = true;
      setWs((prev) => {
        const next = normalizeOrderWorkspacePersistBody({
          ...workspaceToPersistBody(prev),
          ...patch,
          sourceBlocks: patch.sourceBlocks ?? prev.sourceBlocks,
        });
        return applyPersistBodyToWs(next);
      });
      commitWorkspaceLocalNow({ force: true });
    },
    [applyPersistBodyToWs, commitWorkspaceLocalNow],
  );

  const persistFullWorkspaceRef = useCallback(
    async (logContext: string, ui?: { showFlash?: boolean }): Promise<boolean> => {
      if (!orderDraftPersistenceEnabled) {
        workspaceDebugLog("persist_failed", {
          sessionId: payload.sessionId,
          source: "unknown",
          error: "storage_not_durable",
          detail: "ADMIN_ORDER_DRAFT_BLOB_PREFIX + BLOB_READ_WRITE_TOKEN required on Vercel",
        });
        setWorkspaceSaveServerOk(false);
        setWorkspaceAutosaveStatus("error");
        return false;
      }
      if (!workspaceHydratedOnceRef.current) return false;
      syncWsPersistRefFromState();
      const myGen = bumpWorkspaceSaveGeneration();
      workspaceServerSaveGenRef.current = myGen;
      if (ui?.showFlash !== false) setWorkspaceAutosaveStatus("saving");
      let body = normalizeOrderWorkspacePersistBody(workspaceToPersistBody(wsPersistRef.current));
      const baseline = lastGoodPersistBodyRef.current;
      if (baseline && isRegressiveWorkspacePersist(body, baseline)) {
        workspaceDebugLog("overwrite_detected", {
          sessionId: payload.sessionId,
          source: "client_patch",
          fillScore: workspaceHydrationFillScore(body),
          extra: {
            context: logContext,
            baselineScore: workspaceHydrationFillScore(baseline),
            action: "coalesced_with_last_good",
          },
        });
        body = coalesceOrderWorkspacePersistBody(body, baseline);
        wsPersistRef.current = {
          sourceBlocks: body.sourceBlocks,
          iriss: body.iriss,
          apskatesPlāns: body.apskatesPlāns,
          cenasAtbilstiba: body.cenasAtbilstiba,
          previewConfirmed: body.previewConfirmed,
          vehicleAiExtraction: body.vehicleAiExtraction,
          vehicleAiExtractionMeta: body.vehicleAiExtractionMeta,
        };
        wsStateRef.current = wsPersistRef.current;
      }
      const result = await persistWorkspaceState({
        sessionId: payload.sessionId,
        body,
        baseline: lastGoodPersistBodyRef.current,
        pdfVisibility: pdfVisibilityRef.current,
        pdfBannerInclude: pdfBannerIncludeRef.current,
        expectedWorkspaceRevision:
          workspaceRevisionRef.current > 0 ? workspaceRevisionRef.current : undefined,
        saveGeneration: myGen,
        logContext,
        fetchKeepalive: logContext === "navigation_flush",
      });
      if (result.generation !== workspaceServerSaveGenRef.current) return true;
      if (!result.ok) {
        if (typeof result.currentRevision === "number") {
          workspaceRevisionRef.current = result.currentRevision;
        }
        setWorkspaceSaveServerOk(false);
        setWorkspaceAutosaveStatus("error");
        return false;
      }
      lastGoodPersistBodyRef.current = normalizeOrderWorkspacePersistBody(workspaceToPersistBody(wsPersistRef.current));
      workspaceRevisionRef.current = result.workspaceRevision;
      commitWorkspaceLocalNow({ force: true });
      setWorkspaceSaveServerOk(true);
      if (ui?.showFlash !== false) {
        setWorkspaceAutosaveStatus("saved");
        setWorkspaceSaveFlash(true);
      }
      return true;
    },
    [commitWorkspaceLocalNow, orderDraftPersistenceEnabled, payload.sessionId, syncWsPersistRefFromState],
  );

  const buildGeminiOrderPayload = useCallback(
    (extra: { operatorNotes?: string; existingDraftPlain?: string } = {}) => {
      const cur = wsPersistRef.current;
      const edits = orderEditsRef.current;
      return {
        sessionId: payload.sessionId,
        vin: payload.vin,
        listingUrl: payload.listingUrl,
        customerName: payload.customerName,
        notes: payload.notes,
        sourceBlocks: cur.sourceBlocks,
        iriss: cur.iriss,
        apskatesPlāns: cur.apskatesPlāns,
        cenasAtbilstiba: cur.cenasAtbilstiba,
        internalComment: edits.internal,
        mileageComment: edits.mileage,
        sourcesComparisonComment: edits.sourcesComparison,
        operatorNotes: extra.operatorNotes,
        existingDraftPlain: extra.existingDraftPlain,
      };
    },
    [payload.customerName, payload.listingUrl, payload.notes, payload.sessionId, payload.vin],
  );

  const buildGeminiListingPayload = useCallback(() => buildGeminiOrderPayload(), [buildGeminiOrderPayload]);

  const setIrissSummary = useCallback(
    (next: string) => {
      updateWs({ iriss: next });
    },
    [updateWs],
  );

  const runGeminiInspectionRecommendations = useCallback(async (operatorNotes = "", modelTier: GeminiAdminModelTier = "pro") => {
    if (!payload.geminiAllowed || geminiInspectionBusy) return;
    setGeminiInspectionBusy(true);
    setGeminiInspectionErr(null);
    try {
      const cur = wsPersistRef.current;
      const res = await fetch("/api/admin/gemini/inspection-recommendations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildGeminiOrderPayload({
            operatorNotes,
            existingDraftPlain: adminRichHtmlToPlainText(cur.apskatesPlāns).trim(),
          }),
          modelTier,
        }),
      });
      const { data, parseFailed } = await parseAdminGeminiResponse(res);
      if (!res.ok) {
        setGeminiInspectionErr(geminiFetchErrorMessage(res, data, parseFailed, "Gemini: neizdevās ģenerēt"));
        return;
      }
      if (typeof data.text === "string" && data.text.trim()) {
        updateWs({ apskatesPlāns: geminiPlainTextToRichHtml(data.text) });
      }
    } catch {
      setGeminiInspectionErr("Gemini: neizdevās savienoties");
    } finally {
      setGeminiInspectionBusy(false);
    }
  }, [buildGeminiOrderPayload, geminiInspectionBusy, payload.geminiAllowed, updateWs]);

  const runGeminiPriceAnalysis = useCallback(async (operatorNotes = "", modelTier: GeminiAdminModelTier = "pro") => {
    if (!payload.geminiAllowed || geminiPriceBusy) return;
    setGeminiPriceBusy(true);
    setGeminiPriceErr(null);
    try {
      const cur = wsPersistRef.current;
      const res = await fetch("/api/admin/gemini/price-analysis", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildGeminiOrderPayload({
            operatorNotes,
            existingDraftPlain: adminRichHtmlToPlainText(cur.cenasAtbilstiba).trim(),
          }),
          modelTier,
        }),
      });
      const { data, parseFailed } = await parseAdminGeminiResponse(res);
      if (!res.ok) {
        setGeminiPriceErr(geminiFetchErrorMessage(res, data, parseFailed, "Gemini: neizdevās analizēt cenu"));
        return;
      }
      if (typeof data.text === "string" && data.text.trim()) {
        updateWs({ cenasAtbilstiba: geminiExpertSourceCommentToRichHtml(data.text) });
      }
    } catch {
      setGeminiPriceErr("Gemini: neizdevās savienoties");
    } finally {
      setGeminiPriceBusy(false);
    }
  }, [buildGeminiOrderPayload, geminiPriceBusy, payload.geminiAllowed, updateWs]);

  const runGeminiSummaryAnalysis = useCallback(async (operatorNotes = "", modelTier: GeminiAdminModelTier = "pro") => {
    if (!payload.geminiAllowed || geminiSummaryBusy) return;
    setGeminiSummaryBusy(true);
    setGeminiSummaryErr(null);
    try {
      const cur = wsPersistRef.current;
      const res = await fetch("/api/admin/gemini/summary-analysis", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildGeminiOrderPayload({
            operatorNotes,
            existingDraftPlain: adminRichHtmlToPlainText(cur.iriss).trim(),
          }),
          modelTier,
        }),
      });
      const { data, parseFailed } = await parseAdminGeminiResponse(res);
      if (!res.ok) {
        setGeminiSummaryErr(geminiFetchErrorMessage(res, data, parseFailed, "Gemini: neizdevās sagatavot atbildi"));
        return;
      }
      if (typeof data.text === "string" && data.text.trim()) {
        setIrissSummary(geminiPlainTextToRichHtml(data.text));
      }
    } catch {
      setGeminiSummaryErr("Gemini: neizdevās savienoties");
    } finally {
      setGeminiSummaryBusy(false);
    }
  }, [buildGeminiOrderPayload, geminiSummaryBusy, payload.geminiAllowed, setIrissSummary]);

  const runGeminiIncidentsSummary = useCallback(async (operatorNotes = "", modelTier: GeminiAdminModelTier = "pro") => {
    if (!payload.geminiAllowed || geminiIncidentsSummaryBusy) return;
    setGeminiIncidentsSummaryBusy(true);
    setGeminiIncidentsSummaryErr(null);
    try {
      const res = await fetch("/api/admin/gemini/incidents-summary", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildGeminiOrderPayload({
            operatorNotes,
            existingDraftPlain: adminRichHtmlToPlainText(internalCommentDraft).trim(),
          }),
          modelTier,
        }),
      });
      const { data, parseFailed } = await parseAdminGeminiResponse(res);
      if (!res.ok) {
        setGeminiIncidentsSummaryErr(
          geminiFetchErrorMessage(res, data, parseFailed, "Gemini: neizdevās sagatavot atbildi"),
        );
        return;
      }
      if (typeof data.text === "string" && data.text.trim()) {
        onInternalCommentChange(geminiPlainTextToRichHtml(data.text));
      }
    } catch {
      setGeminiIncidentsSummaryErr("Gemini: neizdevās savienoties");
    } finally {
      setGeminiIncidentsSummaryBusy(false);
    }
  }, [
    buildGeminiOrderPayload,
    geminiIncidentsSummaryBusy,
    internalCommentDraft,
    onInternalCommentChange,
    payload.geminiAllowed,
  ]);

  const runGeminiMileageComment = useCallback(async (operatorNotes = "", modelTier: GeminiAdminModelTier = "pro") => {
    if (!payload.geminiAllowed || geminiMileageCommentBusy) return;
    setGeminiMileageCommentBusy(true);
    setGeminiMileageCommentErr(null);
    try {
      const res = await fetch("/api/admin/gemini/mileage-comment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildGeminiOrderPayload({
            operatorNotes,
            existingDraftPlain: adminRichHtmlToPlainText(mileageCommentDraft).trim(),
          }),
          modelTier,
        }),
      });
      const { data, parseFailed } = await parseAdminGeminiResponse(res);
      if (!res.ok) {
        setGeminiMileageCommentErr(
          geminiFetchErrorMessage(res, data, parseFailed, "Gemini: neizdevās sagatavot atbildi"),
        );
        return;
      }
      if (typeof data.text === "string" && data.text.trim()) {
        onMileageCommentChange(geminiPlainTextToRichHtml(data.text));
      }
    } catch {
      setGeminiMileageCommentErr("Gemini: neizdevās savienoties");
    } finally {
      setGeminiMileageCommentBusy(false);
    }
  }, [
    buildGeminiOrderPayload,
    geminiMileageCommentBusy,
    mileageCommentDraft,
    onMileageCommentChange,
    payload.geminiAllowed,
  ]);

  const runGeminiSourcesComparison = useCallback(async (operatorNotes = "", modelTier: GeminiAdminModelTier = "pro") => {
    if (!payload.geminiAllowed || geminiSourcesComparisonBusy) return;
    setGeminiSourcesComparisonBusy(true);
    setGeminiSourcesComparisonErr(null);
    try {
      const res = await fetch("/api/admin/gemini/sources-comparison", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildGeminiOrderPayload({
            operatorNotes,
            existingDraftPlain: adminRichHtmlToPlainText(sourcesComparisonCommentDraft).trim(),
          }),
          modelTier,
        }),
      });
      const { data, parseFailed } = await parseAdminGeminiResponse(res);
      if (!res.ok) {
        setGeminiSourcesComparisonErr(
          geminiFetchErrorMessage(res, data, parseFailed, "Gemini: neizdevās sagatavot avotu salīdzinājumu"),
        );
        return;
      }
      if (typeof data.text === "string" && data.text.trim()) {
        onSourcesComparisonCommentChange(geminiPlainTextToRichHtml(data.text));
      }
    } catch {
      setGeminiSourcesComparisonErr("Gemini: neizdevās savienoties");
    } finally {
      setGeminiSourcesComparisonBusy(false);
    }
  }, [
    buildGeminiOrderPayload,
    geminiSourcesComparisonBusy,
    onSourcesComparisonCommentChange,
    payload.geminiAllowed,
    sourcesComparisonCommentDraft,
  ]);

  const updateSourceBlock = useCallback(
    (key: SourceBlockKey, block: WorkspaceSourceBlocks[SourceBlockKey]) => {
      workspaceDirtyRef.current = true;
      setWs((prev) => {
        const next = normalizeOrderWorkspacePersistBody({
          ...workspaceToPersistBody(prev),
          sourceBlocks: mergeSourceBlocksWithDefaults({
            ...prev.sourceBlocks,
            [key]: block,
          }),
        });
        return applyPersistBodyToWs(next);
      });
      commitWorkspaceLocalNow({ force: true });
    },
    [applyPersistBodyToWs, commitWorkspaceLocalNow],
  );

  const commitListingPhotoGroupsStructural = useCallback(
    async (nextGroups: ListingAnalysisBlockState["photoGroups"]) => {
      const synced = syncListingAnalysisPhotoGroupsAndFlat(nextGroups);
      workspaceDirtyRef.current = true;
      flushSync(() => {
        setWs((prev) => {
          const blocks = mergeSourceBlocksWithDefaults(prev.sourceBlocks);
          const next = normalizeOrderWorkspacePersistBody({
            ...workspaceToPersistBody(prev),
            sourceBlocks: {
              ...blocks,
              listing_analysis: {
                ...blocks.listing_analysis,
                photoGroups: synced.photoGroups,
                photos: synced.photos,
              },
            },
          });
          return applyPersistBodyToWs(next);
        });
      });
      commitWorkspaceLocalNow({ force: true });
      if (orderDraftPersistenceEnabled) {
        await persistFullWorkspaceRef("listing_photos", { showFlash: false });
      }
    },
    [applyPersistBodyToWs, commitWorkspaceLocalNow, orderDraftPersistenceEnabled, persistFullWorkspaceRef],
  );

  const runGeminiTirgusMarket = useCallback(
    async (operatorNotes = "", modelTier: GeminiAdminModelTier = "pro") => {
      if (!payload.geminiAllowed || geminiTirgusMarketBusy) return;
      setGeminiTirgusMarketBusy(true);
      setGeminiTirgusMarketErr(null);
      try {
        const cur = wsPersistRef.current;
        const res = await fetch("/api/admin/gemini/tirgus-market", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildGeminiOrderPayload({
              operatorNotes,
              existingDraftPlain: adminRichHtmlToPlainText(cur.sourceBlocks.tirgus.comments).trim(),
            }),
            modelTier,
          }),
        });
        const { data, parseFailed } = await parseAdminGeminiResponse(res);
        if (!res.ok) {
          setGeminiTirgusMarketErr(
            geminiFetchErrorMessage(res, data, parseFailed, "Gemini: neizdevās analizēt tirgu"),
          );
          return;
        }
        const market = data as {
          comments?: string;
          listedForSale?: string;
          listingCreated?: string;
          priceDrop?: string;
        };
        const comments = typeof market.comments === "string" ? market.comments.trim() : "";
        if (!comments) {
          setGeminiTirgusMarketErr("Gemini: tukšs komentārs");
          return;
        }
        const prev = cur.sourceBlocks.tirgus;
        updateSourceBlock("tirgus", {
          ...prev,
          listedForSale:
            typeof market.listedForSale === "string" && market.listedForSale.trim()
              ? market.listedForSale.trim()
              : prev.listedForSale,
          listingCreated:
            typeof market.listingCreated === "string" && market.listingCreated.trim()
              ? market.listingCreated.trim()
              : prev.listingCreated,
          priceDrop:
            typeof market.priceDrop === "string" && market.priceDrop.trim()
              ? market.priceDrop.trim()
              : prev.priceDrop,
          comments: geminiExpertSourceCommentToRichHtml(comments),
        });
      } catch {
        setGeminiTirgusMarketErr("Gemini: neizdevās savienoties");
      } finally {
        setGeminiTirgusMarketBusy(false);
      }
    },
    [buildGeminiOrderPayload, geminiTirgusMarketBusy, payload.geminiAllowed, updateSourceBlock],
  );

  const runGeminiSourceComment = useCallback(
    async (blockKey: GeminiSourceCommentBlockKey, operatorNotes = "", citiAvotiSectionIndex?: number, modelTier: GeminiAdminModelTier = "pro") => {
      if (!payload.geminiAllowed || geminiSourceCommentBusy) return;
      setGeminiSourceCommentBusy(blockKey);
      setGeminiSourceCommentErr(null);
      try {
        const cur = wsPersistRef.current;
        const existingComments = sourceBlockCommentsPlainForGemini(
          blockKey,
          cur.sourceBlocks,
          citiAvotiSectionIndex,
        );
        const res = await fetch("/api/admin/gemini/source-comment", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildGeminiOrderPayload({
              operatorNotes,
              existingDraftPlain: adminRichHtmlToPlainText(existingComments).trim(),
            }),
            blockKey,
            ...(citiAvotiSectionIndex != null ? { citiAvotiSectionIndex } : {}),
            modelTier,
          }),
        });
        const { data, parseFailed } = await parseAdminGeminiResponse(res);
        if (!res.ok) {
          setGeminiSourceCommentErr({
            key: blockKey,
            msg: geminiFetchErrorMessage(res, data, parseFailed, "Gemini: neizdevās ģenerēt komentāru"),
          });
          return;
        }
        if (typeof data.text === "string" && data.text.trim()) {
          const html = isMainAnalysisSourceBlock(blockKey)
            ? geminiExpertSourceCommentToRichHtml(data.text)
            : geminiPlainTextToRichHtml(data.text);
          const prevBlock = cur.sourceBlocks[blockKey];
          const nextBlock = applySourceBlockGeneratedComment(blockKey, prevBlock, html, {
            citiAvotiSectionIndex,
          });
          updateSourceBlock(blockKey, nextBlock);
        }
      } catch {
        setGeminiSourceCommentErr({ key: blockKey, msg: "Gemini: neizdevās savienoties" });
      } finally {
        setGeminiSourceCommentBusy(null);
      }
    },
    [buildGeminiOrderPayload, geminiSourceCommentBusy, payload.geminiAllowed, updateSourceBlock],
  );

  const runPrepareDraft = useCallback(async () => {
    if (!payload.geminiAllowed || prepareDraftBusy) return;
    const pdfs = portfolioRef.current.filter(
      (p) => p.mime === "application/pdf" || /\.pdf$/i.test(p.name),
    );
    if (pdfs.length === 0) {
      setPrepareDraftErr("Portfelī nav PDF — vispirms pievieno avotu atskaites (CarVertical, AutoDNA u.c.).");
      return;
    }
    setPrepareDraftBusy(true);
    setPrepareDraftErr(null);
    setPrepareDraftNotice(null);
    setPrepareDraftPhase("Analizējam PDF ar Gemini Pro un ģenerējam komentārus…");
    try {
      const cur = wsPersistRef.current;
      const edits = orderEditsRef.current;
      const fd = new FormData();
      fd.set("sessionId", payload.sessionId);
      fd.set("vin", payload.vin ?? "");
      fd.set("listingUrl", payload.listingUrl ?? "");
      fd.set("customerName", payload.customerName ?? "");
      fd.set("notes", payload.notes ?? "");
      fd.set("internalComment", edits.internal);
      fd.set("mileageComment", edits.mileage);
      fd.set("sourcesComparisonComment", edits.sourcesComparison);
      fd.set("sourceBlocks", JSON.stringify(cur.sourceBlocks));
      fd.set("generateComments", "true");
      for (const p of pdfs) {
        const blob = await fetch(p.blobUrl).then((r) => r.blob());
        fd.append(
          "files",
          new File([blob], p.name, { type: p.mime || "application/pdf" }),
        );
      }
      const res = await fetch("/api/admin/prepare-draft", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        sourceBlocks?: WorkspaceSourceBlocks;
        orderEdits?: {
          internalComment?: string;
          mileageComment?: string;
          sourcesComparisonComment?: string;
        };
        steps?: { status: string }[];
        warnings?: string[];
      };
      if (!res.ok) {
        setPrepareDraftErr(
          typeof data.detail === "string" && data.detail.trim()
            ? data.detail
            : data.error === "missing_gemini_key"
              ? "Nav GEMINI_API_KEY serverī"
              : "Neizdevās sagatavot melnrakstu",
        );
        return;
      }
      if (data.sourceBlocks) {
        updateWs({ sourceBlocks: mergeSourceBlocksWithDefaults(data.sourceBlocks) });
      }
      if (typeof data.orderEdits?.internalComment === "string" && data.orderEdits.internalComment.trim()) {
        onInternalCommentChange(data.orderEdits.internalComment);
      }
      if (typeof data.orderEdits?.mileageComment === "string" && data.orderEdits.mileageComment.trim()) {
        onMileageCommentChange(data.orderEdits.mileageComment);
      }
      if (
        typeof data.orderEdits?.sourcesComparisonComment === "string" &&
        data.orderEdits.sourcesComparisonComment.trim()
      ) {
        onSourcesComparisonCommentChange(data.orderEdits.sourcesComparisonComment);
      }
      const okSteps = (data.steps ?? []).filter((s) => s.status === "ok").length;
      const warn = (data.warnings ?? [])[0];
      setPrepareDraftNotice(
        warn
          ? `Melnraksts sagatavots (${okSteps} soļi). ${warn}`
          : `Melnraksts sagatavots (${okSteps} soļi) — pārskati avotu tabulas un komentārus.`,
      );
      setWizardStep(1);
    } catch {
      setPrepareDraftErr("Neizdevās savienoties ar serveri");
    } finally {
      setPrepareDraftBusy(false);
      setPrepareDraftPhase(null);
    }
  }, [
    onInternalCommentChange,
    onMileageCommentChange,
    onSourcesComparisonCommentChange,
    payload.customerName,
    payload.geminiAllowed,
    payload.listingUrl,
    payload.notes,
    payload.sessionId,
    payload.vin,
    prepareDraftBusy,
    updateWs,
  ]);

  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);

  useLayoutEffect(() => {
    setWorkspaceHydrated(false);
    workspaceHydratedOnceRef.current = false;
    workspaceDebugLog("hydrate_start", {
      sessionId: payload.sessionId,
      source: "hydrate",
      durable: orderDraftPersistenceEnabled,
    });
    try {
      const keyV3 = storageKeyWorkspace(payload.sessionId);
      const keyV2 = `${LEGACY_WORKSPACE_V2_PREFIX}${payload.sessionId}`;
      const keyBackup = storageKeyWorkspaceBackup(payload.sessionId);
      const rawV3 = localStorage.getItem(keyV3);
      const rawV2 = localStorage.getItem(keyV2);
      const rawBackup = localStorage.getItem(keyBackup);
      let legacyInternal: string | null = null;
      try {
        legacyInternal = localStorage.getItem(storageKeyInternalLegacy(payload.sessionId));
      } catch {
        /* quota */
      }

      const resolved = resolveOrderWorkspaceHydration({
        localRaw: rawV3,
        localRawLegacyV2: rawV2,
        backupRaw: rawBackup,
        serverWorkspaceJson,
        serverInternalComment: payload.serverInternalComment,
        legacyInternalRaw: legacyInternal,
      });

      const chosen = resolved.hydrated;
      workspaceRevisionRef.current = resolved.workspaceRevision;

      const body: OrderWorkspacePersistBody = {
        sourceBlocks: chosen.sourceBlocks,
        iriss: chosen.iriss,
        apskatesPlāns: chosen.apskatesPlāns,
        cenasAtbilstiba: chosen.cenasAtbilstiba,
        previewConfirmed: Boolean(chosen.previewConfirmed),
        vehicleAiExtraction: chosen.vehicleAiExtraction ?? null,
        vehicleAiExtractionMeta: chosen.vehicleAiExtractionMeta ?? null,
      };

      workspaceDebugLog("hydrate_source", {
        sessionId: payload.sessionId,
        source:
          resolved.source === "local" ||
          resolved.source === "backup" ||
          resolved.source === "legacy"
            ? "localStorage"
            : resolved.source === "server"
              ? "server_ssr"
              : "unknown",
        fillScore: workspaceHydrationFillScore(body),
        revision: resolved.workspaceRevision,
      });

      const hydratedWs: WorkspacePersist = {
        sourceBlocks: chosen.sourceBlocks,
        iriss: chosen.iriss,
        apskatesPlāns: chosen.apskatesPlāns,
        cenasAtbilstiba: chosen.cenasAtbilstiba,
        previewConfirmed: Boolean(chosen.previewConfirmed),
        vehicleAiExtraction: chosen.vehicleAiExtraction ?? null,
        vehicleAiExtractionMeta: chosen.vehicleAiExtractionMeta ?? null,
      };
      wsPersistRef.current = hydratedWs;
      wsStateRef.current = hydratedWs;
      setWs(hydratedWs);
      lastGoodPersistBodyRef.current = body;

      const mergedVisibility = mergePdfVisibility(chosen.pdfVisibility);
      const mergedBannerInclude = mergeProvinBannerPdfInclude(chosen.pdfBannerInclude);
      onPdfVisibilityChange(mergedVisibility);
      setPdfBannerInclude(mergedBannerInclude);

      commitWorkspaceLocalNow({ force: true });
      hydrationSnapshotRef.current = serializeWorkspaceState(hydratedWs, mergedVisibility, mergedBannerInclude);

      if (rawV2) {
        try {
          localStorage.removeItem(keyV2);
        } catch {
          /* quota */
        }
      }
    } catch {
      setWs(EMPTY_WORKSPACE);
      wsPersistRef.current = EMPTY_WORKSPACE;
      wsStateRef.current = EMPTY_WORKSPACE;
      const mergedVisibility = mergePdfVisibility(undefined);
      onPdfVisibilityChange(mergedVisibility);
      setPdfBannerInclude({});
      hydrationSnapshotRef.current = serializeWorkspaceState(EMPTY_WORKSPACE, mergedVisibility, {});
    }
    workspaceHydratedOnceRef.current = true;
    workspaceDirtyRef.current = false;
    setWorkspaceHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serverWorkspaceJson apzināti nav deps: localStorage vienmēr uzvar
  }, [payload.sessionId, payload.serverInternalComment, onPdfVisibilityChange, orderDraftPersistenceEnabled]);

  const persistWorkspaceSnapshot = useCallback(
    async (opts?: { showFlash?: boolean; serverOnly?: boolean }): Promise<boolean> => {
      if (!workspaceHydrated) return false;
      const fromRef = normalizeOrderWorkspacePersistBody(workspaceToPersistBody(wsPersistRef.current));
      let localOk = true;
      if (!opts?.serverOnly) {
        lastGoodPersistBodyRef.current = fromRef;
        const snapshot = serializeOrderWorkspaceSnapshotFromRef(
          fromRef,
          pdfVisibilityRef.current,
          pdfBannerIncludeRef.current,
          new Date().toISOString(),
        );
        try {
          localStorage.setItem(storageKeyWorkspace(payload.sessionId), snapshot);
          const leg = localStorage.getItem(storageKeyInternalLegacy(payload.sessionId));
          if (leg) localStorage.removeItem(storageKeyInternalLegacy(payload.sessionId));
        } catch {
          localOk = false;
        }
        pushWorkspaceBackup(snapshot);
        hydrationSnapshotRef.current = snapshot;
      }

      let serverOk = !orderDraftPersistenceEnabled;
      if (orderDraftPersistenceEnabled && workspaceHydratedOnceRef.current) {
        serverOk = await persistFullWorkspaceRef("manual_save");
      }

      if (opts?.showFlash !== false && serverOk) {
        setWorkspaceSaveServerOk(serverOk);
        setWorkspaceSaveFlash(true);
      }
      return localOk && serverOk;
    },
    [orderDraftPersistenceEnabled, payload.sessionId, persistFullWorkspaceRef, pushWorkspaceBackup, workspaceHydrated],
  );

  const flushWorkspaceServerPatch = useCallback(
    (opts?: { keepalive?: boolean; showFlash?: boolean }): Promise<boolean> => {
      if (!orderDraftPersistenceEnabled || !workspaceHydratedOnceRef.current) return Promise.resolve(false);
      if (workspaceServerSaveTimerRef.current) {
        clearTimeout(workspaceServerSaveTimerRef.current);
        workspaceServerSaveTimerRef.current = null;
      }
      const ctx = opts?.keepalive ? "navigation_flush" : "autosave";
      return persistFullWorkspaceRef(ctx, { showFlash: opts?.showFlash !== false });
    },
    [orderDraftPersistenceEnabled, persistFullWorkspaceRef],
  );

  const forceNavigationFlush = useCallback(() => {
    if (!workspaceHydratedOnceRef.current) return;
    workspaceDirtyRef.current = true;
    if (workspaceServerSaveTimerRef.current) {
      clearTimeout(workspaceServerSaveTimerRef.current);
      workspaceServerSaveTimerRef.current = null;
    }
    flushWorkspaceLocalStorageSync();
    void flushWorkspaceServerPatch({ keepalive: true, showFlash: false });
  }, [flushWorkspaceLocalStorageSync, flushWorkspaceServerPatch]);

  const scheduleWorkspaceServerPatch = useCallback(
    (opts?: { immediate?: boolean; keepalive?: boolean; showFlash?: boolean }) => {
      if (!orderDraftPersistenceEnabled || !workspaceHydratedOnceRef.current) return;
      if (workspaceServerSaveTimerRef.current) {
        clearTimeout(workspaceServerSaveTimerRef.current);
        workspaceServerSaveTimerRef.current = null;
      }
      const run = () => flushWorkspaceServerPatch(opts);
      if (opts?.immediate || opts?.keepalive) {
        run();
        return;
      }
      workspaceServerSaveTimerRef.current = setTimeout(run, WORKSPACE_SERVER_AUTOSAVE_MS);
    },
    [flushWorkspaceServerPatch, orderDraftPersistenceEnabled],
  );

  const flushPersistWorkspace = useCallback(() => {
    commitWorkspaceLocalNow({ force: true });
    scheduleWorkspaceServerPatch({ immediate: true, showFlash: true });
  }, [commitWorkspaceLocalNow, scheduleWorkspaceServerPatch]);

  const goWizardStep = useCallback(
    (next: number | ((prev: number) => number)) => {
      flushPersistWorkspace();
      setWizardStep(next);
    },
    [flushPersistWorkspace],
  );

  useEffect(() => {
    if (!workspaceSaveFlash) return;
    const u = window.setTimeout(() => setWorkspaceSaveFlash(false), 2200);
    return () => window.clearTimeout(u);
  }, [workspaceSaveFlash]);

  const resetDemoWorkspace = useCallback(() => {
    if (!payload.isDemo) return;
    if (
      !window.confirm(
        "Vai tiešām dzēst visus aizpildītos datus šajā demo pasūtījumā? (avoti, kopsavilkums, komentāri, portfelis)",
      )
    ) {
      return;
    }
    const emptyBlocks = createDefaultSourceBlocks();
    const mergedVisibility = mergePdfVisibility(undefined);
    setWs({ ...EMPTY_WORKSPACE, sourceBlocks: emptyBlocks });
    onPdfVisibilityChange(mergedVisibility);
    setPdfBannerInclude({});
    onInternalCommentChange("");
    onMileageCommentChange("");
    onSourcesComparisonCommentChange("");
    setGeminiInspectionErr(null);
    setGeminiPriceErr(null);
    setGeminiSummaryErr(null);
    setGeminiSourceCommentErr(null);
    setPreviewOpen(false);
    setWizardStep(0);
    portfolioRef.current.forEach((p) => URL.revokeObjectURL(p.blobUrl));
    setPortfolio([]);
    void idbDeletePortfolio(payload.sessionId);
    try {
      localStorage.removeItem(storageKeyWorkspace(payload.sessionId));
      hydrationSnapshotRef.current = serializeWorkspaceState(EMPTY_WORKSPACE, mergedVisibility, {});
    } catch {
      /* quota */
    }
    if (orderDraftPersistenceEnabled) {
      void fetch("/api/admin/order-draft", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: payload.sessionId,
          orderEdits: { internalComment: "", mileageComment: "", sourcesComparisonComment: "" },
          workspace: {
            sourceBlocks: emptyBlocks,
            iriss: "",
            apskatesPlāns: "",
            cenasAtbilstiba: "",
            previewConfirmed: false,
            pdfVisibility: mergedVisibility,
            pdfBannerInclude: {},
          },
        }),
      });
    }
  }, [
    onInternalCommentChange,
    onMileageCommentChange,
    onSourcesComparisonCommentChange,
    onPdfVisibilityChange,
    orderDraftPersistenceEnabled,
    payload.isDemo,
    payload.sessionId,
  ]);

  useEffect(() => {
    const onLeave = () => forceNavigationFlush();
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("popstate", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("popstate", onLeave);
    };
  }, [forceNavigationFlush]);

  /** Link / pogas — sinhrons flush pirms Next.js SPA navigācijas (negaidīt unmount). */
  useEffect(() => {
    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      const a = anchor as HTMLAnchorElement;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {
        return;
      }
      forceNavigationFlush();
    };
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [forceNavigationFlush]);

  useLayoutEffect(() => {
    if (pathnameRef.current === pathname) return;
    forceNavigationFlush();
    pathnameRef.current = pathname;
  }, [pathname, forceNavigationFlush]);

  /** SPA navigācija — dublējošs drošības tīkls. */
  useEffect(() => {
    return () => {
      if (workspaceServerSaveTimerRef.current) {
        clearTimeout(workspaceServerSaveTimerRef.current);
        workspaceServerSaveTimerRef.current = null;
      }
      if (!workspaceHydratedOnceRef.current) return;
      flushWorkspaceLocalStorageSync();
      if (workspaceDirtyRef.current) {
        flushWorkspaceServerPatch({ keepalive: true, showFlash: false });
      }
    };
  }, [payload.sessionId, flushWorkspaceLocalStorageSync, flushWorkspaceServerPatch]);

  /** Katra izmaiņa — tūlītējs lokālais saglabājums; serveris — debounce. */
  useEffect(() => {
    if (!workspaceHydrated) return;
    workspaceDirtyRef.current = true;
    commitWorkspaceLocalNow({ force: true });
    setWorkspaceAutosaveStatus("saving");
    const t = window.setTimeout(() => {
      scheduleWorkspaceServerPatch({ showFlash: false });
    }, WORKSPACE_SERVER_AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [ws, pdfVisibility, pdfBannerInclude, workspaceHydrated, commitWorkspaceLocalNow, scheduleWorkspaceServerPatch]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    workspaceDirtyRef.current = true;
    commitWorkspaceLocalNow({ force: true });
  }, [pdfVisibility, pdfBannerInclude, workspaceHydrated, commitWorkspaceLocalNow]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await migrateLegacyPortfolioFromLocalStorage(payload.sessionId);
        const stored = await idbGetPortfolio(payload.sessionId);
        if (cancelled) return;
        if (!stored?.length) {
          setPortfolio([]);
          return;
        }
        const ui: PortfolioEntry[] = stored.map((s) => ({
          id: s.id,
          name: s.name,
          size: s.size,
          mime: s.mime,
          addedAt: s.addedAt,
          blobUrl: URL.createObjectURL(new Blob([s.buffer], { type: s.mime })),
        }));
        if (cancelled) {
          ui.forEach((p) => URL.revokeObjectURL(p.blobUrl));
          return;
        }
        setPortfolio(ui);
      } catch {
        if (!cancelled) setFileError("Neizdevās ielādēt portfeli (IndexedDB). Pārlādē lapu.");
      }
    })();

    return () => {
      cancelled = true;
      portfolioRef.current.forEach((p) => URL.revokeObjectURL(p.blobUrl));
    };
  }, [payload.sessionId]);

  useEffect(() => {
    let cancelled = false;
    const pdfs = portfolio.filter((p) => p.mime === "application/pdf" || /\.pdf$/i.test(p.name));
    if (pdfs.length === 0) {
      setPdfInsights([]);
      setPdfScanning(false);
      setPdfScanError(null);
      return;
    }
    setPdfScanning(true);
    setPdfScanError(null);
    (async () => {
      const out: PdfPortfolioFileInsight[] = [];
      try {
        for (let idx = 0; idx < pdfs.length; idx++) {
          const p = pdfs[idx]!;
          if (cancelled) return;
          const buf = await fetch(p.blobUrl).then((r) => r.arrayBuffer());
          const ins = await analyzePdfBuffer(p.name, buf, idx + 1);
          out.push(ins);
        }
        if (!cancelled) setPdfInsights(out);
      } catch {
        if (!cancelled) {
          setPdfScanError("PDF teksta izvilkšana neizdevās (pārlūks / tīkls).");
          setPdfInsights([]);
        }
      } finally {
        if (!cancelled) setPdfScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portfolio]);

  const persistPortfolio = useCallback(
    async (next: PortfolioEntry[]): Promise<boolean> => {
      const prev = portfolioRef.current;
      try {
        const stored: StoredPortfolioBlob[] = [];
        for (const p of next) {
          const buffer = await fetch(p.blobUrl).then((r) => r.arrayBuffer());
          stored.push({
            id: p.id,
            name: p.name,
            size: p.size,
            mime: p.mime,
            addedAt: p.addedAt,
            buffer,
          });
        }
        await idbSetPortfolio(payload.sessionId, stored);
        for (const p of prev) {
          if (!next.some((n) => n.id === p.id)) URL.revokeObjectURL(p.blobUrl);
        }
        setPortfolio(next);
        setFileError(null);
        setPortfolioPersistFlash(true);
        window.setTimeout(() => setPortfolioPersistFlash(false), 2000);
        return true;
      } catch {
        const prevIds = new Set(prev.map((p) => p.id));
        for (const p of next) {
          if (!prevIds.has(p.id)) URL.revokeObjectURL(p.blobUrl);
        }
        setFileError(
          "Neizdevās saglabāt portfeli IndexedDB. Ja kvota joprojām pilna, noņem dažus failus vai izmanto mazākus PDF.",
        );
        return false;
      }
    },
    [payload.sessionId],
  );

  const openNotifyClientDialog = useCallback(() => {
    setNotifyErr(null);
    setNotifyPhase("idle");
    setNotifyLastSentTo(null);
    setNotifyDialogOpen(true);
  }, []);

  const sendNotifyWithWorkspaceAttachments = useCallback(async () => {
    setNotifyErr(null);
    if (payload.paymentStatus?.toLowerCase() !== "paid") {
      setNotifyErr("Nosūtīt var tikai apmaksātam pasūtījumam.");
      setNotifyPhase("error");
      return;
    }
    const email = (payload.customerEmail ?? "").trim();
    if (!email || !isValidOrderEmail(email)) {
      setNotifyErr("Nepieciešams derīgs klienta e-pasts (sadaļā „Klienta dati”).");
      setNotifyPhase("error");
      return;
    }
    const ESTIMATE_INVOICE = 450 * 1024;
    if (portfolioBytes + ESTIMATE_INVOICE > NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES) {
      setNotifyErr(
        `Portfeļa apjoms (~${formatBytes(Math.round(portfolioBytes))}) kopā ar rēķinu var pārsniegt e-pasta limitu (~${formatBytes(NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES)}). Noņem failus no portfeļa vai samazini to izmēru.`,
      );
      setNotifyPhase("error");
      return;
    }
    setNotifyPhase("loading");
    try {
      const extraRaw = notifyReportPdfExtraRef.current?.files?.[0] ?? null;
      const auditName = buildProvinAuditPdfFilename(payload.vin);
      const extraReport =
        extraRaw && extraRaw.size > 0
          ? new File([extraRaw], auditName, {
              type: extraRaw.type || "application/pdf",
              lastModified: extraRaw.lastModified,
            })
          : null;
      const uploads: NotifyPortfolioUploadItem[] = [];
      for (const p of portfolio) {
        const blob = await fetch(p.blobUrl).then((r) => r.blob());
        const mime = fileMimeForPortfolio(p, blob);
        if (!NOTIFY_ALLOWED_MIME.has(mime)) {
          setNotifyErr(`Neatbalsts faila veids: „${p.name}”. Atļauti tikai PDF un JPEG/PNG/WEBP/GIF.`);
          setNotifyPhase("error");
          return;
        }
        const buffer = await blob.arrayBuffer();
        uploads.push({
          buffer,
          name: p.name,
          mime,
          lastModified: Number.isFinite(Date.parse(p.addedAt)) ? Date.parse(p.addedAt) : Date.now(),
        });
      }

      const blobOn = await isNotifyBlobUploadEnabled();
      const useBlob =
        blobOn && (uploads.length > 0 || (extraReport && extraReport.size > 0));

      const { res, data } = useBlob
        ? await postNotifyReportReadyViaBlob({
            sessionId: payload.sessionId,
            customerEmail: email,
            uploads,
            extraAuditPdf: extraReport,
          })
        : await (async () => {
            const fd = new FormData();
            fd.append("sessionId", payload.sessionId);
            fd.append("customerEmail", email);
            if (extraReport) {
              fd.append("reportPdf", extraReport);
            }
            for (const u of uploads) {
              const b = new Blob([u.buffer], { type: u.mime });
              const file = new File([b], u.name, {
                type: u.mime,
                lastModified: u.lastModified ?? Date.now(),
              });
              fd.append("attachment", file);
            }
            return postNotifyReportReadyMultipart(fd);
          })();
      const message = typeof data.message === "string" ? data.message : null;
      const detail = typeof data.detail === "string" ? data.detail : null;
      const composed = [message, detail].filter(Boolean).join(" — ") || null;
      if (!res.ok) {
        const fallback = typeof data.error === "string" ? data.error : "Neizdevās nosūtīt";
        setNotifyErr(composed ?? fallback);
        setNotifyPhase("error");
        return;
      }
      if (notifyReportPdfExtraRef.current) notifyReportPdfExtraRef.current.value = "";
      setNotifyDialogOpen(false);
      const sentTo = typeof data.sentTo === "string" ? data.sentTo.trim() : null;
      setNotifyLastSentTo(sentTo);
      setNotifyPhase("sent");
      window.setTimeout(() => {
        setNotifyPhase("idle");
        setNotifyLastSentTo(null);
      }, 6000);
    } catch (e) {
      setNotifyErr(e instanceof Error ? e.message : "Tīkla kļūda");
      setNotifyPhase("error");
    }
  }, [
    payload.sessionId,
    payload.paymentStatus,
    payload.customerEmail,
    payload.vin,
    portfolio,
    portfolioBytes,
  ]);

  const onPickFiles = async (files: FileList | null) => {
    setFileError(null);
    setPortfolioUploadNotice(null);
    if (!files?.length) return;
    const prevIds = new Set(portfolio.map((p) => p.id));
    const next = [...portfolio];
    let total = next.reduce((s, p) => s + p.size, 0);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_BYTES) {
        setFileError(`Fails „${file.name}” ir par lielu (max ${formatBytes(MAX_FILE_BYTES)}).`);
        continue;
      }
      if (total + file.size > MAX_TOTAL_BYTES) {
        setFileError(`Kopējais apjoms pārsniedz ${formatBytes(MAX_TOTAL_BYTES)}. Noņem failus vai izvēlies mazākus.`);
        break;
      }
      const buffer = await file.arrayBuffer();
      const mime = file.type || "application/octet-stream";
      const blobUrl = URL.createObjectURL(new Blob([buffer], { type: mime }));
      total += file.size;
      next.unshift({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        mime,
        addedAt: new Date().toISOString(),
        blobUrl,
      });
    }
    const added = next.filter((p) => !prevIds.has(p.id));
    const ok = await persistPortfolio(next);
    if (ok && added.length > 0) {
      const label =
        added.length === 1
          ? `Pievienots un saglabāts: ${added[0]!.name}`
          : `Pievienoti un saglabāti ${added.length} faili`;
      setPortfolioUploadNotice(label);
      window.setTimeout(() => setPortfolioUploadNotice(null), 4500);
    }
  };

  const removePortfolio = (id: string) => {
    const victim = portfolio.find((p) => p.id === id);
    if (victim) URL.revokeObjectURL(victim.blobUrl);
    void persistPortfolio(portfolio.filter((p) => p.id !== id));
  };

  /** PDF drīkst ģenerēt arī ar tukšiem laukiem — redzamība kontrolēta ar `pdfVisibility`. */
  const canGeneratePdf = true;

  const geminiCommentSlot = useCallback(
    (key: GeminiSourceCommentBlockKey, citiAvotiSectionIndex?: number): AdminGeminiSourceCommentSlot => {
      const hasSourceData =
        key === "citi_avoti" && citiAvotiSectionIndex != null ?
          citiAvotiSectionPlainTextExcludingComments(
            blocksDisplaySafe.citi_avoti.sections[citiAvotiSectionIndex] ?? emptyCitiAvotiSection(),
          ).length > 0
        : sourceBlockHasDataExcludingComments(key, blocksDisplaySafe);
      return {
        allowed: payload.geminiAllowed,
        busy: geminiSourceCommentBusy === key,
        error: geminiSourceCommentErr?.key === key ? geminiSourceCommentErr.msg : null,
        hasSourceData,
        onGenerate: (operatorNotes, modelTier) =>
          void runGeminiSourceComment(key, operatorNotes, citiAvotiSectionIndex, modelTier),
      };
    },
    [
      blocksDisplaySafe,
      geminiSourceCommentBusy,
      geminiSourceCommentErr,
      payload.geminiAllowed,
      runGeminiSourceComment,
    ],
  );

  const patchBannerPdfInclude = useCallback((kind: ProvinBannerKind, included: boolean) => {
    setPdfBannerInclude((prev) => ({ ...prev, [kind]: included }));
  }, []);

  const provinAlertBanners = useMemo(() => {
    try {
      return computeProvinAlertBannersFromWorkspace(blocksDisplaySafe);
    } catch {
      return [];
    }
  }, [blocksDisplaySafe]);

  const provinInfoBanners = useMemo(() => {
    try {
      return computeProvinInfoBannersFromWorkspace(blocksDisplaySafe);
    } catch {
      return [];
    }
  }, [blocksDisplaySafe]);

  const hasIncidentDataForGemini = useMemo(() => {
    try {
      return orderHasIncidentDataForGemini(blocksDisplaySafe);
    } catch {
      return false;
    }
  }, [blocksDisplaySafe]);

  const hasMileageDataForGemini = useMemo(() => {
    try {
      return orderHasMileageDataForGemini(blocksDisplaySafe);
    } catch {
      return false;
    }
  }, [blocksDisplaySafe]);

  const hasSourceDataForGemini = useMemo(() => {
    try {
      return orderHasSourceDataForGemini(blocksDisplaySafe);
    } catch {
      return false;
    }
  }, [blocksDisplaySafe]);

  const traffic = useMemo(() => {
    const b = blocksDisplaySafe;
    const empty = {
      csdd: "empty" as const,
      autodna: "empty" as const,
      carvertical: "empty" as const,
      auto_records: "empty" as const,
      ltab: "empty" as const,
      citi_avoti: "empty" as const,
      listingSection: "empty" as const,
    };
    try {
      return {
        csdd: csddTrafficLevel(b.csdd),
        autodna: vendorAvotuTrafficLevel(b?.autodna),
        carvertical: vendorAvotuTrafficLevel(b?.carvertical),
        auto_records: autoRecordsTrafficLevel(b.auto_records),
        ltab: ltabTrafficLevel(b.ltab),
        citi_avoti: citiAvotiTrafficLevel(b.citi_avoti),
        listingSection: listingSectionTrafficLevel(b.tirgus, b.listing_analysis),
      };
    } catch {
      return empty;
    }
  }, [blocksDisplaySafe]);

  const expertTraffic = (() => {
    try {
      return expertSummaryTrafficLevel({
        iriss: ws.iriss ?? "",
        apskatesPlāns: ws.apskatesPlāns ?? "",
        cenasAtbilstiba: ws.cenasAtbilstiba ?? "",
        previewConfirmed: ws.previewConfirmed,
      });
    } catch {
      return "empty" as const;
    }
  })();

  const wizardStepLevels = useMemo((): TrafficFillLevel[] => {
    const dash = dashboardWizardTrafficLevel(payload);
    const vendors = worstTrafficLevel(traffic.autodna, traffic.carvertical);
    return [
      dash,
      traffic.csdd,
      vendors,
      traffic.auto_records,
      traffic.ltab,
      traffic.citi_avoti,
      traffic.listingSection,
      expertTraffic,
    ];
  }, [payload, traffic, expertTraffic]);

  const wizardStepsUi = useMemo(
    () =>
      [
        { label: "Pārskats", Icon: LayoutDashboard },
        { label: "CSDD", Icon: ClipboardList },
        { label: "Datu serv.", Icon: Layers },
        { label: "Auto Records", Icon: CarFront },
        { label: "LTAB", Icon: Scale },
        { label: "Citi avoti", Icon: Link2 },
        { label: "Sludinājums", Icon: Newspaper },
        { label: "Kopsavilkums", Icon: ListChecks },
      ] as const,
    [],
  );

  const wizardProgressPct = useMemo(
    () => workspaceWizardProgressPct(wizardStepLevels),
    [wizardStepLevels],
  );

  const openPrintReport = async () => {
    syncWsPersistRefFromState();
    if (orderDraftPersistenceEnabled) {
      await flushWorkspaceServerPatch({ showFlash: false });
    }

    let listingMarket: ListingMarketSnapshot | null = null;
    const listingUrl = payload.listingUrl?.trim();
    if (listingUrl) {
      try {
        const res = await fetch("/api/admin/scrape-listing", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: listingUrl }),
        });
        if (res.ok) {
          listingMarket = (await res.json()) as ListingMarketSnapshot;
        }
      } catch {
        listingMarket = null;
      }
    }

    const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long", timeStyle: "short" });
    const flatSources = blocksToLegacyFlatFields(blocksDisplaySafe);
    const listingBlocks = mergeSourceBlocksWithDefaults(wsPersistRef.current.sourceBlocks);
    const photoIds = (listingBlocks.listing_analysis.photos ?? []).map((p) => p.id);
    const listingAnalysisPhotoDataUrls = new Map<string, string>();
    let resolvedPhotoIds = photoIds;
    if (photoIds.length > 0) {
      try {
        const res = await fetch("/api/admin/listing-analysis-photo/pdf-batch", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: payload.sessionId, photoIds }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          dataUrls?: Record<string, string>;
          missing?: string[];
        };
        if (res.ok && data.dataUrls) {
          for (const [id, url] of Object.entries(data.dataUrls)) {
            listingAnalysisPhotoDataUrls.set(id, url);
          }
          const fromBatch = Object.keys(data.dataUrls);
          resolvedPhotoIds = [
            ...photoIds.filter((id) => data.dataUrls![id]),
            ...fromBatch.filter((id) => !photoIds.includes(id)),
          ];
        }
      } catch {
        /* PDF bez fotogrāfijām, ja batch neizdevās */
      }
    }
    const listingAnalysisForPdf = {
      ...listingBlocks.listing_analysis,
      photos: resolvedPhotoIds
        .filter((id) => listingAnalysisPhotoDataUrls.has(id))
        .map((id) => ({ id })),
    };
    const html = buildClientReportDocumentHtml({
      payload: {
        ...payload,
        ...flatSources,
        csddForm: blocksDisplaySafe.csdd,
        tirgusForm: blocksDisplaySafe.tirgus,
        manualVendorBlocks: toPdfManualVendorBlocks(blocksDisplaySafe),
        manualLtabBlock: toPdfLtabManualBlock(blocksDisplaySafe.ltab),
        autoRecordsBlock: blocksDisplaySafe.auto_records,
        citiAvoti: blocksDisplaySafe.citi_avoti,
        listingAnalysis: listingAnalysisForPdf,
        iriss: ws.iriss,
        apskatesPlāns: ws.apskatesPlāns,
        cenasAtbilstiba: ws.cenasAtbilstiba,
        listingMarket,
        pdfVisibility,
        pdfBannerInclude,
        internalComment: internalCommentDraft,
        mileageComment: mileageCommentDraft,
      },
      portfolio: portfolio.map((p) => ({ name: p.name, size: p.size })),
      pdfInsights,
      dateFmt,
      formatBytes,
      listingAnalysisPhotoDataUrls,
    });

    const w = window.open("", "_blank");
    if (!w) {
      alert("Atļauj uznirstošo logu, lai atvērtu druku.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();

    const vinSlug = (payload.vin?.trim().replace(/[^A-Za-z0-9]/g, "_") || "nav_VIN").slice(0, 48);
    const printTitle = `Atskaite_${vinSlug}.pdf`;
    let printed = false;
    const schedulePrint = () => {
      if (printed) return;
      printed = true;
      try {
        w.document.title = printTitle;
        w.focus();
        w.print();
      } catch {
        printed = false;
      }
    };
    w.addEventListener("load", () => window.setTimeout(schedulePrint, 450), { once: true });
    window.setTimeout(schedulePrint, 900);
  };

  const previewBody = (
    <div
      className={`admin-order-page fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 ${adminDark ? "dark" : ""}`}
      role="dialog"
      aria-modal="true"
      onClick={() => setPreviewOpen(false)}
    >
      <div
        className="max-h-[90vh] w-full max-w-[min(96rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[var(--color-apple-text)]">Priekšskats — apkopota informācija</h3>
        <p className="mt-1.5 text-sm leading-snug text-[var(--color-provin-muted)]">
          Secība: <strong className="text-[var(--color-apple-text)]">1)</strong> pielikumu faili,{" "}
          <strong className="text-[var(--color-apple-text)]">2)</strong> piezīmju bloki pēc avota (tabulas tiek saliktas
          automātiski no ielīmētā teksta). Sludinājumu „liekie” teikumi (piem., autorizācijas aicinājumi) tiek izfiltrēti.
          Tukši avotu bloki PDF netiek drukāti.
        </p>

        {(previewAnalysis.vinIssues.length > 0 || previewAnalysis.kmIssues.length > 0) && (
          <div className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950">
            <p className="font-semibold text-amber-900">Pārbaudi datus (VIN / nobraukums)</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              {[...previewAnalysis.vinIssues, ...previewAnalysis.kmIssues].map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {(previewAnalysis.vins.length > 0 || previewAnalysis.kmByBlock.some((k) => k.kms.length > 0)) && (
          <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-xs text-[var(--color-provin-muted)]">
            {previewAnalysis.vins.length > 0 ? (
              <div>
                <span className="font-semibold text-[var(--color-apple-text)]">VIN: </span>
                {previewAnalysis.vins.map((v, i) => (
                  <span key={i}>
                    {i > 0 ? " · " : null}
                    {v.label}: {v.values.join(", ")}
                  </span>
                ))}
              </div>
            ) : null}
            {previewAnalysis.kmByBlock.length > 0 ? (
              <div className={previewAnalysis.vins.length > 0 ? "mt-1.5" : ""}>
                <span className="font-semibold text-[var(--color-apple-text)]">Nobraukuma kandidāti (km): </span>
                {previewAnalysis.kmByBlock.map((k, i) => (
                  <span key={k.label}>
                    {i > 0 ? " · " : null}
                    {k.label}: {k.kms.map((n) => n.toLocaleString("lv-LV")).join(", ")}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <ol className="mt-3 list-decimal space-y-3 pl-4 text-sm text-[var(--color-apple-text)]">
          <li>
            <span className="font-medium">Pievienotie PDF / faili</span>
            {portfolio.length === 0 ? (
              <p className="mt-1 text-[var(--color-provin-muted)]">Nav failu.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[var(--color-provin-muted)]">
                {portfolio.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ul>
            )}
            {pdfScanning ? (
              <p className="mt-2 text-xs text-[var(--color-provin-muted)]">
                PDF analīze (teksta slānis; ja vajag — OCR pirmajām lapām, var aizņemt līdz minūtei)…
              </p>
            ) : null}
            {pdfScanError ? <p className="mt-2 text-xs text-amber-800">{pdfScanError}</p> : null}
            {!pdfScanning && pdfInsights.length > 0 ? (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs">
                <p className="font-medium text-[var(--color-apple-text)]">
                  No PDF automātiski (teksta slānis; skenētiem — OCR uz pārlūku)
                </p>
                <p className="text-[var(--color-provin-muted)]">
                  Atslēgvārdi (negadījumi, atsaukumi, u.c.) un nobraukuma skaitļi. OCR pirmās līdz četrām lapām, ja teksts
                  PDF ir īss. Salīdziniet ar oriģināļiem — tabulas atšķiras.
                </p>
                {mergedKmPoints.length >= 2 ? <KmMergeChart points={mergedKmPoints} /> : null}
                {pdfInsights.map((ins, fi) => (
                  <div
                    key={`${ins.sourceOrdinal}-${fi}`}
                    className="rounded-lg border border-slate-100 bg-white px-2.5 py-2"
                  >
                    <p className="font-medium text-[var(--color-apple-text)]">
                      Pārskats {ins.sourceOrdinal}
                      <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">
                        {ins.fileName}
                      </span>
                    </p>
                    {ins.ocrPages ? (
                      <p className="mt-0.5 text-[11px] font-medium text-emerald-900">
                        OCR: {ins.ocrPages} lapas — teksts papildināts no attēla (pirmoreiz jāielādē valodu dati no
                        tīkla).
                      </p>
                    ) : null}
                    {ins.highlights.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[var(--color-provin-muted)]">
                        {ins.highlights.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[var(--color-provin-muted)]">Nav atrastu brīdinājuma atslēgvārdu.</p>
                    )}
                    {ins.kmSamples.length > 0 ? (
                      <p className="mt-1 text-[var(--color-provin-muted)]">
                        Nobraukuma paraugi: {ins.kmSamples.map((s) => s.km.toLocaleString("lv-LV")).join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </li>
          {SOURCE_BLOCK_KEYS.map((key) => (
            <li key={key}>
              <span className="font-medium">{SOURCE_BLOCK_LABELS[key]}</span>
              <PreviewWorkspaceBody
                text={orderSourceBlockPlainText(key, blocksDisplaySafe)}
                variant="default"
              />
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-[var(--color-apple-text)] hover:bg-slate-50"
          >
            Aizvērt
          </button>
          <button
            type="button"
            onClick={() => {
              updateWs({ previewConfirmed: true });
              setPreviewOpen(false);
            }}
            className="rounded-full bg-[var(--color-provin-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-95"
          >
            Apstiprinu — turpināt uz kopsavilkumu
          </button>
        </div>
      </div>
    </div>
  );

  const portfolioShellClass = `${workspaceSectionShell} min-h-[150px] min-w-0 flex flex-col ${
    narrowPortfolioLayout ? "h-full max-h-[min(88vh,960px)] overflow-y-auto overflow-x-hidden" : ""
  }`;

  const portfolioInlineList =
    portfolio.length > PORTFOLIO_INLINE_VISIBLE_MAX
      ? portfolio.slice(0, PORTFOLIO_INLINE_VISIBLE_MAX)
      : portfolio;
  const portfolioHiddenCount =
    portfolio.length > PORTFOLIO_INLINE_VISIBLE_MAX
      ? portfolio.length - PORTFOLIO_INLINE_VISIBLE_MAX
      : 0;

  const portfolioSection = (
    <section id="admin-order-section-pielikumi" className={portfolioShellClass}>
      <div
        className={`flex gap-1 ${narrowPortfolioLayout ? "flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" : "flex-wrap items-center justify-between"}`}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h2 className={`${workspaceSectionTitle} flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-0`}>
            <span>1. Pielikumi</span>
            {portfolioPersistFlash ? (
              <span className="text-[10px] font-semibold normal-case tracking-normal text-emerald-700" role="status">
                Saglabāts
              </span>
            ) : null}
            {notifyPhase === "sent" ? (
              <span
                className="inline-flex max-w-[min(100%,18rem)] flex-col gap-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-700"
                role="status"
              >
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                  E-pasts nosūtīts
                </span>
                {notifyLastSentTo ? (
                  <span className="break-all font-normal text-emerald-900/85" title="Faktiskais saņēmējs">
                    → {notifyLastSentTo}
                  </span>
                ) : null}
              </span>
            ) : null}
          </h2>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {payload.geminiAllowed ? (
              <button
                type="button"
                onClick={() => void runPrepareDraft()}
                disabled={prepareDraftBusy || portfolio.every((p) => p.mime !== "application/pdf" && !/\.pdf$/i.test(p.name))}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-provin-accent)]/30 bg-[var(--color-provin-accent-soft)]/80 px-2 py-1 text-[10px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-[var(--color-provin-accent-soft)] disabled:cursor-not-allowed disabled:opacity-45"
                title="Portfeļa PDF → avotu tabulas + Gemini Pro komentāru melnraksts"
              >
                {prepareDraftBusy ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                )}
                Sagatavot melnrakstu
              </button>
            ) : null}
            {payload.paymentStatus?.toLowerCase() === "paid" &&
            payload.customerEmail?.trim() &&
            isValidOrderEmail(payload.customerEmail.trim()) ? (
              <button
                type="button"
                onClick={openNotifyClientDialog}
                disabled={notifyPhase === "loading"}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-700/25 bg-emerald-50/90 px-2 py-1 text-[10px] font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100/95 disabled:opacity-50 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
                title="Nosūtīt klientam e-pastu ar portfeļa failiem un rēķinu"
              >
                <Send className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                Nosūtīt klientam
              </button>
            ) : null}
            <AdminPdfIncludeToggle
              checked={pdfVisibility.portfolio}
              onChange={(next) => onPdfVisibilityChange({ portfolio: next })}
            />
          </div>
        </div>
      </div>
      {prepareDraftPhase ? (
        <p className="mt-1 text-[10px] leading-snug text-[var(--color-provin-accent)]" role="status">
          {prepareDraftPhase}
        </p>
      ) : null}
      {prepareDraftNotice ? (
        <p className="mt-1 text-[10px] leading-snug text-emerald-800/90" role="status">
          {prepareDraftNotice}
        </p>
      ) : null}
      {prepareDraftErr ? (
        <p className="mt-1 text-[10px] leading-snug text-amber-800/90" role="alert">
          {prepareDraftErr}
        </p>
      ) : null}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          portfolioDragDepth.current += 1;
          setPortfolioDropActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          portfolioDragDepth.current = Math.max(0, portfolioDragDepth.current - 1);
          if (portfolioDragDepth.current === 0) setPortfolioDropActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          portfolioDragDepth.current = 0;
          setPortfolioDropActive(false);
          void onPickFiles(e.dataTransfer.files);
        }}
        onPaste={(e) => {
          const items = e.clipboardData?.items;
          if (!items?.length) return;
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it?.kind === "file" && it.type.startsWith("image/")) {
              e.preventDefault();
              const f = it.getAsFile();
              if (f) {
                const dt = new DataTransfer();
                dt.items.add(f);
                void onPickFiles(dt.files);
              }
              return;
            }
          }
        }}
        tabIndex={0}
        role="region"
        aria-label="Pielikumu zona"
        className={`mt-1 min-w-0 rounded-lg border border-dashed px-1.5 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/35 ${
          portfolioDropActive
            ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/35"
            : "border-transparent"
        } ${narrowPortfolioLayout ? "flex flex-col gap-1" : "flex flex-wrap items-center gap-x-3 gap-y-0.5"}`}
      >
        <p
          className={`text-[10px] leading-tight text-[var(--color-provin-muted)] ${narrowPortfolioLayout ? "" : "max-w-[min(100%,28rem)]"}`}
        >
          Velc, izvēlies vai ielīmē attēlu šeit (zonai jābūt fokusā).
        </p>
        <div className={`flex min-w-0 flex-wrap items-center gap-1 ${narrowPortfolioLayout ? "flex-col items-stretch" : ""}`}>
          <input
            id={fileInputId}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <label
            htmlFor={fileInputId}
            className={`${workspaceToolbarBtn} inline-flex min-w-0 cursor-pointer justify-center ${narrowPortfolioLayout ? "w-full sm:w-auto" : "shrink-0"}`}
          >
            Pievienot failus…
          </label>
          <span className="text-[10px] leading-tight text-[var(--color-provin-muted)]">
            līdz {formatBytes(MAX_FILE_BYTES)} / fails · kopā ~{formatBytes(MAX_TOTAL_BYTES)} (
            {formatBytes(Math.round(portfolioBytes))})
          </span>
        </div>
      </div>
      {fileError ? <p className="mt-1 text-[11px] text-amber-800">{fileError}</p> : null}
      {portfolioUploadNotice ? (
        <p
          className="mt-1 rounded-md border border-emerald-200/90 bg-emerald-50/95 px-2 py-1.5 text-[11px] font-medium leading-snug text-emerald-950"
          role="status"
        >
          {portfolioUploadNotice}
        </p>
      ) : null}
      {portfolio.length > 0 ? (
        <div className="mt-1 min-w-0 flex-1">
          <ul className={`${narrowPortfolioLayout ? "space-y-0" : "space-y-0.5"}`}>
            {portfolioInlineList.map((p) => (
              <AdminSavablePortfolioFileRow
                key={p.id}
                index={portfolio.indexOf(p)}
                file={p}
                formatBytes={formatBytes}
                onRemove={() => removePortfolio(p.id)}
                compact={narrowPortfolioLayout}
              />
            ))}
          </ul>
          {portfolioHiddenCount > 0 ? (
            <button
              type="button"
              className="mt-1 w-full rounded-md border border-dashed border-[var(--color-provin-accent)]/40 bg-white/90 py-1.5 text-center text-[10px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:border-[var(--color-provin-accent)]/60 hover:bg-[var(--color-provin-accent-soft)]/40"
              onClick={() => setPortfolioAllFilesModalOpen(true)}
            >
              + vēl {portfolioHiddenCount}{" "}
              {portfolioHiddenCount === 1 ? "fails" : "faili"}…
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 flex-1 text-[11px] leading-tight text-[var(--color-provin-muted)]">Vēl nav pievienotu failu.</p>
      )}
    </section>
  );

  const portfolioAllFilesModal =
    portfolioAllFilesModalOpen && portfolio.length > 0 ? (
      <div
        className={`admin-order-page fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 ${adminDark ? "dark" : ""}`}
        role="presentation"
        onClick={() => setPortfolioAllFilesModalOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="portfolio-all-files-title"
          className="flex max-h-[min(85dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--admin-border-subtle)] px-3 py-2">
            <h3
              id="portfolio-all-files-title"
              className="text-sm font-semibold text-[var(--color-apple-text)]"
            >
              Visi faili ({portfolio.length})
            </h3>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-[var(--color-apple-text)] hover:bg-slate-50"
              onClick={() => setPortfolioAllFilesModalOpen(false)}
            >
              Aizvērt
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <ul className="space-y-0.5">
              {portfolio.map((p, i) => (
                <AdminSavablePortfolioFileRow
                  key={p.id}
                  index={i}
                  file={p}
                  formatBytes={formatBytes}
                  onRemove={() => removePortfolio(p.id)}
                  compact
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    ) : null;

  const showPortfolioInline = !portfolioPortalDomId || !portfolioPortalEl;
  const showPortfolioPortal = Boolean(portfolioPortalDomId && portfolioPortalEl);

  const alertsSection =
    provinAlertBanners.length > 0 || provinInfoBanners.length > 0 ? (
      <section id="admin-order-section-bridinajumi" className={`${workspaceSectionShell} mb-1.5`}>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className={workspaceSectionTitle}>Brīdinājumi un informācija (PDF)</h2>
          <AdminPdfIncludeToggle
            checked={pdfVisibility.alerts}
            onChange={(next) => onPdfVisibilityChange({ alerts: next })}
          />
        </div>
        <div className="space-y-2">
          <AdminProvinAlertBanners
            banners={provinAlertBanners}
            infoBanners={provinInfoBanners}
            pdfInclude={pdfBannerInclude}
            onPdfIncludeChange={patchBannerPdfInclude}
          />
        </div>
      </section>
    ) : null;

  const showAlertsPortal = Boolean(alertsPortalDomId && alertsPortalEl);

  const vinBar = (payload.vin ?? "").trim();
  const whatsappPhoneDigits = normalizeWhatsAppPhoneDigits(payload.customerPhone);

  const generateAuditPdfForWhatsApp = useCallback(async (): Promise<File | null> => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    const marginX = 44;
    const marginTop = 48;
    const marginBottom = 44;
    const baseSize = 10;
    const lineHeight = 14;
    const titleSize = 14;
    const maxLineWidth = 595 - marginX * 2;
    const widthOfText = (value: string) => font.widthOfTextAtSize(toWinAnsiSafeText(value), baseSize);
    let page = pdf.addPage([595, 842]);
    let y = page.getHeight() - marginTop;
    const ensureSpace = (need: number) => {
      if (y - need > marginBottom) return;
      page = pdf.addPage([595, 842]);
      y = page.getHeight() - marginTop;
    };
    const drawLine = (value: string) => {
      ensureSpace(lineHeight);
      page.drawText(toWinAnsiSafeText(value), {
        x: marginX,
        y,
        size: baseSize,
        font,
        color: rgb(0.11, 0.11, 0.11),
      });
      y -= lineHeight;
    };
    const drawHeading = (value: string) => {
      ensureSpace(22);
      page.drawText(toWinAnsiSafeText(value), {
        x: marginX,
        y,
        size: titleSize,
        font: titleFont,
        color: rgb(0.05, 0.05, 0.05),
      });
      y -= 20;
    };
    const drawParagraph = (value: string) => {
      const normalized = value.trim();
      if (!normalized) {
        y -= 6;
        return;
      }
      const lines = wrapPdfTextLine(normalized.replace(/\s+/g, " "), maxLineWidth, widthOfText);
      for (const ln of lines) drawLine(ln);
      y -= 4;
    };

    const sourceTexts: Array<{ title: string; text: string }> = [
      { title: "CSDD", text: csddFormToPlainText(blocksDisplaySafe.csdd) },
      { title: "Datu servisi", text: [vendorAvotuBlockToPlainText(blocksDisplaySafe.autodna), vendorAvotuBlockToPlainText(blocksDisplaySafe.carvertical)].filter(Boolean).join("\n\n") },
      { title: "Auto Records", text: autoRecordsBlockToPlainText(blocksDisplaySafe.auto_records) },
      { title: "LTAB", text: ltabBlockToPlainText(blocksDisplaySafe.ltab) },
      { title: "Citi avoti", text: citiAvotiToPlainText(blocksDisplaySafe.citi_avoti) },
      { title: "Sludinājuma analīze", text: listingAnalysisToPlainText(blocksDisplaySafe.listing_analysis) },
      { title: "Kopsavilkums", text: ws.iriss ?? "" },
      { title: "Apskates plāns", text: ws.apskatesPlāns ?? "" },
      { title: "Cenas atbilstība", text: ws.cenasAtbilstiba ?? "" },
    ];

    drawHeading("PROVIN AUDITS");
    drawParagraph(`VIN: ${(payload.vin ?? "—").trim() || "—"}`);
    drawParagraph(`Klients: ${(payload.customerName ?? "—").trim() || "—"}`);
    drawParagraph(`Tālrunis: ${(payload.customerPhone ?? "—").trim() || "—"}`);
    drawParagraph(`E-pasts: ${(payload.customerEmail ?? "—").trim() || "—"}`);
    drawParagraph(`Izveidots: ${new Date().toLocaleString("lv-LV")}`);
    drawParagraph("");

    for (const section of sourceTexts) {
      const body = section.text.trim();
      if (!body) continue;
      drawHeading(section.title);
      const chunks = body.split(/\n+/).map((x) => x.trim()).filter(Boolean);
      for (const chunk of chunks) drawParagraph(chunk);
      y -= 2;
    }

    const pdfBytes = await pdf.save();
    const pdfBlob = new Blob([Uint8Array.from(pdfBytes)], { type: "application/pdf" });
    return new File([pdfBlob], buildProvinAuditPdfFilename(payload.vin), { type: "application/pdf" });
  }, [blocksDisplaySafe, payload.customerEmail, payload.customerName, payload.customerPhone, payload.vin, ws.apskatesPlāns, ws.cenasAtbilstiba, ws.iriss]);

  const handleWhatsAppSend = useCallback(async () => {
    if (!whatsappPhoneDigits) return;
    const chatWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
    try {
      const pdfFile = await generateAuditPdfForWhatsApp();
      if (!pdfFile) {
        chatWindow?.close();
        return;
      }
      const objectUrl = URL.createObjectURL(pdfFile);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = pdfFile.name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);

      openWhatsAppChat(whatsappPhoneDigits, WHATSAPP_PREFILL_MESSAGE, chatWindow);
      alert("Atvērts WhatsApp čats. PDF atskaite lejupielādēta automātiski — pievienojiet to kā pielikumu ziņai.");
    } catch (error) {
      chatWindow?.close();
      alert(error instanceof Error ? error.message.slice(0, 220) : "Neizdevās sagatavot PDF WhatsApp nosūtīšanai.");
    }
  }, [generateAuditPdfForWhatsApp, whatsappPhoneDigits]);

  return (
    <div className="relative min-w-0 pb-24">
      {previewOpen ? previewBody : null}

      {portfolioAllFilesModal != null && typeof document !== "undefined"
        ? createPortal(portfolioAllFilesModal, document.body)
        : null}

      {notifyDialogOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`admin-order-page fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-3 ${adminDark ? "dark" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="workspace-notify-email-title"
              onClick={() => {
                if (notifyPhase !== "loading") setNotifyDialogOpen(false);
              }}
            >
              <div
                className="max-h-[min(90vh,520px)] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] p-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="workspace-notify-email-title" className="text-sm font-semibold text-[var(--color-apple-text)]">
                  Nosūtīt klientam e-pastu
                </h3>
                <p className="mt-2 text-[11px] leading-snug text-[var(--color-provin-muted)]">
                  Tiks pievienoti <strong>visi portfeļa faili</strong> ({portfolio.length}). Rēķins netiek sūtīts atkārtoti — klients to jau saņēma pēc apmaksas. Kopējais pielikumu apjoms — līdz ~{formatBytes(NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES)}.
                </p>
                <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
                  Saņēmējs
                </p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-[var(--color-apple-text)]">
                  {payload.customerEmail?.trim()}
                </p>
                <div className="mt-3 border-t border-[var(--admin-border-subtle)] pt-3">
                  <label className="mb-1 block text-[10px] font-medium text-[var(--color-provin-muted)]">
                    Papildu audita PDF (ja nav portfelī) — nosūtīts kā{" "}
                    <span className="font-mono">{buildProvinAuditPdfFilename(payload.vin)}</span>
                  </label>
                  <input
                    ref={notifyReportPdfExtraRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="block w-full text-[11px] text-[var(--color-apple-text)] file:mr-2 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-2 file:py-1 file:text-[11px] dark:file:border-zinc-600 dark:file:bg-zinc-800"
                  />
                </div>
                {notifyErr ? (
                  <p className="mt-2 text-[11px] leading-snug text-red-600">{notifyErr}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={notifyPhase === "loading"}
                    className="rounded-lg border border-[var(--admin-border-subtle)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-apple-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50"
                    onClick={() => setNotifyDialogOpen(false)}
                  >
                    Atcelt
                  </button>
                  <button
                    type="button"
                    disabled={notifyPhase === "loading"}
                    onClick={() => void sendNotifyWithWorkspaceAttachments()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-provin-accent)] px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-95 disabled:opacity-50"
                  >
                    {notifyPhase === "loading" ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    )}
                    Sūtīt
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {alertsPortalDomId && showAlertsPortal && alertsSection
        ? createPortal(alertsSection, alertsPortalEl!)
        : null}
      {!alertsPortalDomId && alertsSection}

      {showPortfolioPortal ? createPortal(portfolioSection, portfolioPortalEl!) : null}

      <AdminCommonPhrasesDrawer open={phrasesOpen} onClose={() => setPhrasesOpen(false)} />

      {!workspaceHydrated ? (
        <p className="mx-auto mb-3 max-w-lg px-2 text-center text-sm text-[var(--color-provin-muted)]" role="status">
          Ielādē saglabātos avotu datus…
        </p>
      ) : null}

      <AdminPersistenceHealthBanner durableConfigured={orderDraftPersistenceEnabled} />

      <nav
        className="sticky top-0 z-30 -mx-1 border-b border-[var(--admin-border-subtle)] bg-[var(--admin-nav-bg)] px-1 py-1.5 backdrop-blur-sm"
        aria-label="Soli pa solim"
      >
        <div className={`mx-auto flex w-full min-w-0 flex-wrap items-center gap-2 ${ADMIN_CONTENT_MAX}`}>
          <button
            type="button"
            className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-1.5 text-[var(--color-apple-text)] shadow-sm transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            title={`${ADMIN_INCIDENTS_SUMMARY_LABEL} — solis „Kopsavilkums”`}
            aria-label={`Pāriet uz ${ADMIN_INCIDENTS_SUMMARY_LABEL} (kopsavilkuma solis)`}
            onClick={() => goWizardStep(7)}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!workspaceHydrated || workspaceSaveBusy}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-emerald-700/25 bg-emerald-50/90 px-2 text-[10px] font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-100"
            title="Saglabāt avotu datus (papildus automātiskajam saglabājumam) — lokāli un serverī"
            onClick={() => {
              setWorkspaceSaveBusy(true);
              void persistWorkspaceSnapshot().finally(() => setWorkspaceSaveBusy(false));
            }}
          >
            {workspaceSaveBusy ? "Saglabā…" : "Saglabāt"}
          </button>
          {workspaceAutosaveStatus === "saving" ? (
            <span className="text-[10px] font-medium text-[var(--color-provin-muted)]" role="status">
              Saglabā…
            </span>
          ) : workspaceAutosaveStatus === "error" ? (
            <span className="max-w-[12rem] text-[10px] font-semibold leading-tight text-amber-800" role="status">
              Kļūda saglabājot
            </span>
          ) : workspaceSaveFlash || workspaceAutosaveStatus === "saved" ? (
            <span
              className={`max-w-[11rem] text-[10px] font-semibold leading-tight ${
                orderDraftPersistenceEnabled && !workspaceSaveServerOk ? "text-amber-800" : "text-emerald-700"
              }`}
              role="status"
            >
              {!orderDraftPersistenceEnabled
                ? "Saglabāts pārlūkā"
                : workspaceSaveServerOk
                  ? "Saglabāts"
                  : "Saglabāts pārlūkā — servera melnraksts neizdevās"}
            </span>
          ) : null}
          {payload.isDemo ? (
            <button
              type="button"
              className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-amber-300/80 bg-amber-50 px-1.5 text-amber-900 shadow-sm transition hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
              title="Dzēst visus demo datus un sākt no jauna"
              aria-label="Dzēst visus demo datus"
              onClick={() => resetDemoWorkspace()}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          <AdminCommonPhrasesDrawerTrigger open={phrasesOpen} onOpen={() => setPhrasesOpen(true)} />
          <div className="flex min-w-0 flex-1 flex-wrap items-stretch gap-1 sm:gap-1.5">
            {wizardStepsUi.map(({ label, Icon }, idx) => {
              const lvl = wizardStepLevels[idx] ?? "empty";
              const active = wizardStep === idx;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => goWizardStep(idx)}
                  className={`flex min-w-0 max-w-[7.5rem] flex-1 flex-col items-center gap-0.5 rounded-lg border px-1 py-1 text-center transition sm:max-w-none sm:flex-row sm:justify-start sm:gap-1.5 sm:px-2 ${
                    active
                      ? "border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/35"
                      : "border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-black/[0.06] text-[var(--color-provin-muted)] dark:bg-white/10">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span
                      className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--admin-surface-elevated)] ${WIZARD_STEP_DOT[lvl]}`}
                      title={`Aizpildījums: ${lvl}`}
                    />
                  </span>
                  <span
                    className={`line-clamp-2 w-full text-[9px] font-semibold uppercase leading-tight tracking-tight sm:line-clamp-1 sm:text-left ${
                      active ? "text-[var(--color-apple-text)]" : "text-[var(--color-provin-muted)]"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <div
            className={`flex min-w-0 max-w-full shrink-0 items-center gap-1 rounded-lg border border-[var(--admin-border-subtle)] bg-black/[0.03] px-1.5 py-0.5 font-mono text-[8px] font-medium text-[var(--color-apple-text)] dark:bg-white/[0.06] sm:text-[9px] ${
              vinBar ? "" : "text-[var(--color-provin-muted)]"
            }`}
            title="VIN"
          >
            <span className="max-w-[10rem] truncate sm:max-w-[14rem]">{vinBar || "— VIN —"}</span>
            {vinBar ? (
              <AdminVinCopyButton
                value={vinBar}
                onCopied={() => {
                  setVinBarCopyFlash(true);
                  window.setTimeout(() => setVinBarCopyFlash(false), 600);
                }}
              />
            ) : null}
            {whatsappPhoneDigits ? (
              <button
                type="button"
                onClick={handleWhatsAppSend}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-emerald-400/80 bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-1"
                title={`WhatsApp: ${payload.customerPhone ?? ""}`}
                aria-label="Ģenerēt PDF un atvērt WhatsApp ar ziņu klientam"
              >
                <WhatsAppIconGlyph />
              </button>
            ) : (
              <span
                className="inline-flex h-6 w-6 cursor-not-allowed items-center justify-center rounded-md border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] text-[var(--color-provin-muted)] opacity-60"
                title="Nav klienta tālruņa WhatsApp atvēršanai"
                aria-hidden
              >
                <WhatsAppIconGlyph />
              </span>
            )}
            {vinBarCopyFlash ? (
              <span className="text-[8px] font-semibold text-emerald-600 dark:text-emerald-400" role="status">
                OK
              </span>
            ) : null}
          </div>
        </div>
        <div className={`mx-auto mt-2 px-1 ${ADMIN_CONTENT_MAX}`}>
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/10"
            role="progressbar"
            aria-valuenow={wizardProgressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Aizpildījuma progress"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out dark:bg-emerald-400"
              style={{ width: `${wizardProgressPct}%` }}
            />
          </div>
          <p className="mt-0.5 text-end text-[9px] font-medium tabular-nums text-[var(--color-provin-muted)]">
            {wizardProgressPct}%
          </p>
        </div>
      </nav>

      <div className={`mx-auto w-full min-w-0 space-y-3 px-1 pt-3 ${ADMIN_CONTENT_MAX}`}>
        {portfolioPortalDomId && !portfolioPortalTargetInParent ? (
          <div id={portfolioPortalDomId} className="min-h-0 min-w-0" />
        ) : null}
        {showPortfolioInline ? portfolioSection : null}

        {dashboardSlot ? (
          <div className={wizardStep === 0 ? "space-y-3" : "hidden"} aria-hidden={wizardStep !== 0}>
            {dashboardSlot}
          </div>
        ) : null}

        {wizardStep === 1 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
              <AdminPdfIncludeToggle
                checked={pdfVisibility.unifiedMileage}
                onChange={(next) => onPdfVisibilityChange({ unifiedMileage: next })}
              />
              <span className="text-[9px] font-medium text-[var(--color-provin-muted)]">Nobraukuma tabula PDF</span>
              <AdminPdfIncludeToggle
                checked={pdfVisibility.unifiedIncidents}
                onChange={(next) => onPdfVisibilityChange({ unifiedIncidents: next })}
              />
              <span className="text-[9px] font-medium text-[var(--color-provin-muted)]">Negadījumi PDF</span>
            </div>
            <div id="admin-order-block-csdd" className="w-full min-w-0">
              <AdminCsddSourceBlock
                value={blocksDisplaySafe.csdd}
                readOnly={false}
                onChange={(next) => updateSourceBlock("csdd", next)}
                trafficFillLevel={traffic.csdd}
                pdfIncludeBlock={pdfVisibility.csdd}
                onPdfIncludeBlockChange={(next) => onPdfVisibilityChange({ csdd: next })}
                pdfIncludeMileageTable={pdfVisibility.csddMileageTable}
                onPdfIncludeMileageTableChange={(next) => onPdfVisibilityChange({ csddMileageTable: next })}
                sessionId={payload.sessionId}
                geminiComment={geminiCommentSlot("csdd")}
              />
            </div>
          </div>
        ) : null}

        {wizardStep === 2 ? (
          <div className="grid min-h-0 min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
            <div id="admin-order-block-autodna" className="flex min-h-0 min-w-0 flex-col">
              <AdminVendorAvotuSourceBlock
                blockKey="autodna"
                value={blocksDisplaySafe.autodna}
                readOnly={false}
                onChange={(next) => updateSourceBlock("autodna", next)}
                trafficFillLevel={traffic.autodna}
                sessionId={payload.sessionId}
                pdfInclude={pdfVisibility.autodna}
                onPdfIncludeChange={(next) => onPdfVisibilityChange({ autodna: next })}
                geminiComment={geminiCommentSlot("autodna")}
                autodnaApiConfigured={autodnaApiConfigured}
              />
            </div>
            <div id="admin-order-block-carvertical" className="flex min-h-0 min-w-0 flex-col">
              <AdminVendorAvotuSourceBlock
                blockKey="carvertical"
                value={blocksDisplaySafe.carvertical}
                readOnly={false}
                onChange={(next) => updateSourceBlock("carvertical", next)}
                trafficFillLevel={traffic.carvertical}
                sessionId={payload.sessionId}
                pdfInclude={pdfVisibility.carvertical}
                onPdfIncludeChange={(next) => onPdfVisibilityChange({ carvertical: next })}
                geminiComment={geminiCommentSlot("carvertical")}
              />
            </div>
          </div>
        ) : null}

        {wizardStep === 3 ? (
          <div id="admin-order-block-auto-records" className="min-w-0">
            <AdminAutoRecordsSourceBlock
              value={blocksDisplaySafe.auto_records}
              readOnly={false}
              onChange={(next) => updateSourceBlock("auto_records", next)}
              trafficFillLevel={traffic.auto_records}
              sessionId={payload.sessionId}
              pdfInclude={pdfVisibility.auto_records}
              onPdfIncludeChange={(next) => onPdfVisibilityChange({ auto_records: next })}
              geminiComment={geminiCommentSlot("auto_records")}
              orderVin={payload.vin}
            />
          </div>
        ) : null}

        {wizardStep === 4 ? (
          <div id="admin-order-block-ltab" className="min-w-0">
            <AdminLtabSourceBlock
              value={blocksDisplaySafe.ltab}
              readOnly={false}
              onChange={(next) => updateSourceBlock("ltab", next)}
              trafficFillLevel={traffic.ltab}
              sessionId={payload.sessionId}
              pdfInclude={pdfVisibility.ltab}
              onPdfIncludeChange={(next) => onPdfVisibilityChange({ ltab: next })}
              geminiComment={geminiCommentSlot("ltab")}
            />
          </div>
        ) : null}

        {wizardStep === 5 ? (
          <div id="admin-order-block-citi-avoti" className="min-w-0">
            <AdminCitiAvotiSourceBlock
              value={blocksDisplaySafe.citi_avoti}
              readOnly={false}
              onChange={(next) => updateSourceBlock("citi_avoti", next)}
              trafficFillLevel={traffic.citi_avoti}
              sessionId={payload.sessionId}
              pdfInclude={pdfVisibility.citi_avoti}
              onPdfIncludeChange={(next) => onPdfVisibilityChange({ citi_avoti: next })}
              geminiComment={(i) => geminiCommentSlot("citi_avoti", i)}
            />
          </div>
        ) : null}

        {wizardStep === 6 ? (
          <section id="admin-order-section-sludinajums" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={workspaceSectionTitle}>Sludinājuma analīze</h2>
              <AdminPdfIncludeToggle
                checked={pdfVisibility.sludinajums}
                onChange={(next) => onPdfVisibilityChange({ sludinajums: next })}
              />
            </div>
            <div className="mt-1.5 overflow-hidden rounded-xl border-0 bg-transparent shadow-[0_2px_22px_rgba(15,23,42,0.055)] dark:shadow-[0_2px_22px_rgba(0,0,0,0.4)]">
              <ListingAnalysisMainBlockTitleRow
                icon={LISTING_ANALYSIS_CHROME_LUCIDE.mainSection}
                title="SLUDINĀJUMA ANALĪZE"
                trafficStripClass={TRAFFIC_HEADER_STRIP_CLASS[traffic.listingSection]}
              />
              <div className="space-y-3 bg-transparent px-2 pb-2 pt-2">
                <ListingAnalysisSubsectionHeading
                  icon={LISTING_ANALYSIS_CHROME_LUCIDE.listingHistory}
                  title={LISTING_HISTORY_SUBSECTION_TITLE}
                >
                  <div className="rounded-lg border border-[#E2E8F0] bg-transparent px-2 py-2">
                    <AdminTirgusSourceBlock
                      value={blocksDisplaySafe.tirgus}
                      readOnly={false}
                      onChange={(next) => updateSourceBlock("tirgus", next)}
                      variant="embedded"
                      geminiComment={geminiCommentSlot("tirgus")}
                      marketGeminiAllowed={payload.geminiAllowed}
                      marketGeminiBusy={geminiTirgusMarketBusy}
                      marketGeminiError={geminiTirgusMarketErr}
                      onMarketGeminiAnalyze={(notes, tier) => void runGeminiTirgusMarket(notes, tier)}
                    />
                  </div>
                </ListingAnalysisSubsectionHeading>
                <div className="min-w-0 border-t border-slate-200/75 pt-4">
                  <AdminListingAnalysisSourceBlock
                    value={blocksDisplaySafe.listing_analysis}
                    readOnly={false}
                    onChange={(next) => updateSourceBlock("listing_analysis", next)}
                    variant="priority"
                    autoGrow
                    geminiAllowed={payload.geminiAllowed}
                    buildGeminiPayload={buildGeminiListingPayload}
                    sessionId={payload.sessionId}
                    photosPersistenceEnabled={orderDraftPersistenceEnabled}
                    onListingPhotoGroupsStructuralCommit={commitListingPhotoGroupsStructural}
                  />
                </div>
                <ListingAnalysisSubsectionHeading icon={IRISS_CHROME_LUCIDE.priceFit} title="3. Cenas atbilstība">
                  <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                    <AdminGeminiGenerateWithPrefill
                      label="Analizēt cenu"
                      busy={geminiPriceBusy}
                      disabled={!payload.geminiAllowed}
                      demoOnly={!payload.geminiAllowed}
                      onGenerate={(operatorNotes, modelTier) => void runGeminiPriceAnalysis(operatorNotes, modelTier)}
                    />
                  </div>
                  {geminiPriceErr ? (
                    <p className="mb-1.5 text-[9px] leading-snug text-amber-800/90" title={geminiPriceErr}>
                      {geminiPriceErr}
                    </p>
                  ) : null}
                  <AdminAiPolishRichCommentShell
                    value={ws.cenasAtbilstiba ?? ""}
                    onChange={(next) => updateWs({ cenasAtbilstiba: next })}
                    aria-label="Cenas atbilstība"
                  />
                </ListingAnalysisSubsectionHeading>
              </div>
            </div>
          </section>
        ) : null}

        {wizardStep === 7 ? (
          <section id="admin-order-section-kopsavilkums" className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className={`${workspaceSectionTitle} flex flex-wrap items-baseline gap-x-2 gap-y-0`}>
                  <span>Kopsavilkums</span>
                </h2>
              </div>
              <AdminPdfIncludeToggle
                checked={pdfVisibility.iriss}
                onChange={(next) => onPdfVisibilityChange({ iriss: next })}
              />
            </div>
            <div className="mt-1.5 overflow-hidden rounded-xl border-0 bg-transparent shadow-[0_2px_22px_rgba(15,23,42,0.055)] dark:shadow-[0_2px_22px_rgba(0,0,0,0.4)]">
              <ListingAnalysisMainBlockTitleRow
                icon={IRISS_CHROME_LUCIDE.mainSection}
                title="APPROVED BY IRISS"
                trafficStripClass=""
              />
              <div className="space-y-3 bg-transparent px-2 pb-2 pt-2">
                <ListingAnalysisSubsectionHeading
                  icon={IRISS_CHROME_LUCIDE.inspection}
                  title="1. Ieteikumi klātienes apskatei"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                    <AdminGeminiGenerateWithPrefill
                      label="Ģenerēt ieteikumus"
                      busy={geminiInspectionBusy}
                      disabled={!payload.geminiAllowed}
                      demoOnly={!payload.geminiAllowed}
                      onGenerate={(operatorNotes, modelTier) =>
                        void runGeminiInspectionRecommendations(operatorNotes, modelTier)}
                    />
                  </div>
                  {geminiInspectionErr ? (
                    <p className="mb-1.5 text-[9px] leading-snug text-amber-800/90" title={geminiInspectionErr}>
                      {geminiInspectionErr}
                    </p>
                  ) : null}
                  <AdminAiPolishRichCommentShell
                    value={ws.apskatesPlāns ?? ""}
                    onChange={(next) => updateWs({ apskatesPlāns: next })}
                    aria-label="Ieteikumi klātienes apskatei"
                  />
                </ListingAnalysisSubsectionHeading>
                <ListingAnalysisSubsectionHeading icon={IRISS_CHROME_LUCIDE.summary} title="2. Kopsavilkums">
                  <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                    <AdminGeminiGenerateWithPrefill
                      label="Sagatavot atbildi"
                      busy={geminiSummaryBusy}
                      disabled={
                        !payload.geminiAllowed ||
                        !(
                          adminRichHtmlToPlainText(ws.sourceBlocks.listing_analysis.sellerPortrait).trim() ||
                          adminRichHtmlToPlainText(ws.apskatesPlāns).trim() ||
                          adminRichHtmlToPlainText(ws.cenasAtbilstiba).trim()
                        )
                      }
                      demoOnly={!payload.geminiAllowed}
                      title={
                        !payload.geminiAllowed
                          ? undefined
                          : !(
                                adminRichHtmlToPlainText(ws.sourceBlocks.listing_analysis.sellerPortrait).trim() ||
                                adminRichHtmlToPlainText(ws.apskatesPlāns).trim() ||
                                adminRichHtmlToPlainText(ws.cenasAtbilstiba).trim()
                              )
                            ? "Vispirms ģenerē vai aizpildi pārdevēja, ieteikumu vai cenas sadaļu"
                            : undefined
                      }
                      onGenerate={(operatorNotes, modelTier) => void runGeminiSummaryAnalysis(operatorNotes, modelTier)}
                    />
                  </div>
                  {geminiSummaryErr ? (
                    <p className="mb-1.5 text-[9px] leading-snug text-amber-800/90" title={geminiSummaryErr}>
                      {geminiSummaryErr}
                    </p>
                  ) : null}
                  <AdminAiPolishRichCommentShell
                    value={ws.iriss ?? ""}
                    onChange={setIrissSummary}
                    aria-label="Galvenais kopsavilkums klientam"
                  />
                </ListingAnalysisSubsectionHeading>
                <ListingAnalysisSubsectionHeading
                  icon={IRISS_CHROME_LUCIDE.internalNote}
                  title={ADMIN_INCIDENTS_SUMMARY_LABEL}
                >
                  <p className="text-[10px] leading-snug text-[var(--color-provin-muted)]">
                    Glabājas pasūtījuma melnrakstā; PDF drukā zem „Negadījumu vēstures” kā plakans teksts (bez vizuālā
                    formatējuma).
                    Saglabājas automātiski.
                  </p>
                  <div className="mb-2 mt-2 flex flex-wrap items-center justify-end gap-2">
                    <AdminGeminiGenerateWithPrefill
                      label="Sagatavot atbildi"
                      busy={geminiIncidentsSummaryBusy}
                      disabled={!payload.geminiAllowed}
                      demoOnly={!payload.geminiAllowed}
                      onGenerate={(operatorNotes, modelTier) =>
                        void runGeminiIncidentsSummary(operatorNotes, modelTier)}
                    />
                  </div>
                  {geminiIncidentsSummaryErr ? (
                    <p className="mb-1.5 text-[9px] leading-snug text-amber-800/90" title={geminiIncidentsSummaryErr}>
                      {geminiIncidentsSummaryErr}
                    </p>
                  ) : null}
                  <div className="mt-2">
                    <AdminAiPolishRichCommentShell
                      compact
                      value={internalCommentDraft}
                      onChange={onInternalCommentChange}
                      aria-label={ADMIN_INCIDENTS_SUMMARY_LABEL}
                    />
                  </div>
                </ListingAnalysisSubsectionHeading>
                <ListingAnalysisSubsectionHeading
                  icon={IRISS_CHROME_LUCIDE.internalNote}
                  title={ADMIN_MILEAGE_HISTORY_COMMENT_LABEL}
                >
                  <p className="text-[10px] leading-snug text-[var(--color-provin-muted)]">
                    Glabājas pasūtījuma melnrakstā; PDF drukā zem nobraukuma grafika kā komentārs. Saglabājas automātiski.
                  </p>
                  <div className="mb-2 mt-2 flex flex-wrap items-center justify-end gap-2">
                    <AdminGeminiGenerateWithPrefill
                      label="Sagatavot atbildi"
                      busy={geminiMileageCommentBusy}
                      disabled={!payload.geminiAllowed || !hasMileageDataForGemini}
                      demoOnly={!payload.geminiAllowed}
                      title={
                        !payload.geminiAllowed
                          ? undefined
                          : !hasMileageDataForGemini
                            ? "Vispirms aizpildi nobraukuma tabulas avotos"
                            : undefined
                      }
                      onGenerate={(operatorNotes, modelTier) => void runGeminiMileageComment(operatorNotes, modelTier)}
                    />
                  </div>
                  {geminiMileageCommentErr ? (
                    <p className="mb-1.5 text-[9px] leading-snug text-amber-800/90" title={geminiMileageCommentErr}>
                      {geminiMileageCommentErr}
                    </p>
                  ) : null}
                  <div className="mt-2">
                    <AdminAiPolishRichCommentShell
                      compact
                      value={mileageCommentDraft}
                      onChange={onMileageCommentChange}
                      aria-label={ADMIN_MILEAGE_HISTORY_COMMENT_LABEL}
                    />
                  </div>
                </ListingAnalysisSubsectionHeading>
                <ListingAnalysisSubsectionHeading
                  icon={IRISS_CHROME_LUCIDE.sourcesComparison}
                  title={ADMIN_SOURCES_COMPARISON_LABEL}
                >
                  <p className="text-[10px] leading-snug text-[var(--color-provin-muted)]">
                    Iekšējs materiāls blogam un mārketingam — netiek iekļauts klienta PDF. Ģenerē pēc visu avotu
                    apkopošanas. Saglabājas automātiski.
                  </p>
                  <div className="mb-2 mt-2 flex flex-wrap items-center justify-end gap-2">
                    <AdminGeminiGenerateWithPrefill
                      label="Salīdzināt avotus"
                      busy={geminiSourcesComparisonBusy}
                      disabled={!payload.geminiAllowed || !hasSourceDataForGemini}
                      demoOnly={!payload.geminiAllowed}
                      title={
                        !payload.geminiAllowed
                          ? undefined
                          : !hasSourceDataForGemini
                            ? "Vispirms aizpildi avotu sadaļas"
                            : undefined
                      }
                      onGenerate={(operatorNotes, modelTier) =>
                        void runGeminiSourcesComparison(operatorNotes, modelTier)}
                    />
                  </div>
                  {geminiSourcesComparisonErr ? (
                    <p
                      className="mb-1.5 text-[9px] leading-snug text-amber-800/90"
                      title={geminiSourcesComparisonErr}
                    >
                      {geminiSourcesComparisonErr}
                    </p>
                  ) : null}
                  <div className="mt-2">
                    <AdminAiPolishRichCommentShell
                      compact
                      value={sourcesComparisonCommentDraft}
                      onChange={onSourcesComparisonCommentChange}
                      aria-label={ADMIN_SOURCES_COMPARISON_LABEL}
                    />
                  </div>
                </ListingAnalysisSubsectionHeading>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--admin-border-subtle)] bg-[var(--admin-footer-bg)] px-3 py-2.5 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)]">
        <div className={`mx-auto flex w-full min-w-0 flex-wrap items-center justify-end gap-2 ${ADMIN_CONTENT_MAX}`}>
          <button
            type="button"
            className={wizardFooterNav}
            disabled={wizardStep <= 0}
            onClick={() => goWizardStep((s) => Math.max(0, s - 1))}
          >
            Atpakaļ
          </button>
          <button
            type="button"
            className={wizardFooterNav}
            disabled={wizardStep >= WIZARD_STEP_COUNT - 1}
            onClick={() => goWizardStep((s) => Math.min(WIZARD_STEP_COUNT - 1, s + 1))}
          >
            Turpināt
          </button>
          <button type="button" onClick={() => setPreviewOpen(true)} className={wizardFooterPreview}>
            PDF Priekšskats
          </button>
          <button type="button" onClick={() => void openPrintReport()} className={wizardFooterPdf}>
            Ģenerēt PDF
          </button>
        </div>
      </div>
    </div>
  );
}

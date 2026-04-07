"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  emptyVendorAvotuBlock,
  hydrateWorkspaceFromStorage,
  listingAnalysisToPlainText,
  ltabBlockToPlainText,
  autoRecordsBlockToPlainText,
  standardBlockToPlainText,
  vendorAvotuBlockToPlainText,
  tirgusFormToPlainText,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type SourceBlockKey,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  idbGetPortfolio,
  idbSetPortfolio,
  migrateLegacyPortfolioFromLocalStorage,
  type StoredPortfolioBlob,
} from "@/lib/admin-portfolio-idb";
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
import {
  APPROVED_BY_IRISS_BODY_BG,
  APPROVED_BY_IRISS_HEADER_BG,
  LISTING_ANALYSIS_BODY_BG,
  SOURCE_BLOCK_HEADER_BG,
} from "@/lib/admin-header-gradients";
import { AdminGradientHeaderBar } from "@/components/admin/AdminGradientHeaderBar";
import type { ListingMarketSnapshot } from "@/lib/listing-scrape";

export type OrderWorkspacePayload = {
  sessionId: string;
  isDemo: boolean;
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
};

const EMPTY_WORKSPACE: WorkspacePersist = {
  sourceBlocks: createDefaultSourceBlocks(),
  iriss: "",
  apskatesPlāns: "",
  cenasAtbilstiba: "",
  previewConfirmed: false,
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;

/** Portfeļa kolonnā pēc noklusējuma redzams pirmā fails; pārējie — modālā. */
const PORTFOLIO_INLINE_VISIBLE_MAX = 1;

const workspaceToolbarBtn =
  "rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-semibold tracking-tight text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

const workspaceSectionTitle = `font-bold uppercase tracking-wide text-[var(--color-apple-text)] ${SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS}`;

const workspaceSectionShell = "rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm";

const bulkTextareaClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-sm leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20";

const bulkReadonlyClass =
  "w-full rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-sm leading-snug whitespace-pre-wrap text-[var(--color-apple-text)] min-h-[52px]";

function storageKeyWorkspace(sessionId: string) {
  return `provin-admin-workspace-v3-${sessionId}`;
}

const LEGACY_WORKSPACE_V2_PREFIX = "provin-admin-workspace-v2-";

/** Vecais viena lauka komentārs */
function storageKeyInternalLegacy(sessionId: string) {
  return `provin-admin-internal-v1-${sessionId}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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
  portfolioPortalDomId,
  serverWorkspaceJson = null,
  orderDraftPersistenceEnabled = false,
}: {
  payload: OrderWorkspacePayload;
  /** Ja norādīts, „1. Portfelis” tiek renderēts šajā DOM elementā (augšējā 4 kolonnu režģī). */
  portfolioPortalDomId?: string;
  /** SSR ielādēts darba zonas JSON (prioritāte pār localStorage). */
  serverWorkspaceJson?: string | null;
  orderDraftPersistenceEnabled?: boolean;
}) {
  const fileInputId = useId();
  const [ws, setWs] = useState<WorkspacePersist>(EMPTY_WORKSPACE);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioEntry[]>([]);
  const portfolioRef = useRef<PortfolioEntry[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfInsights, setPdfInsights] = useState<PdfPortfolioFileInsight[]>([]);
  const [pdfScanning, setPdfScanning] = useState(false);
  const [pdfScanError, setPdfScanError] = useState<string | null>(null);
  const [sourcesViewMode, setSourcesViewMode] = useState(false);
  const [sourcesSnap, setSourcesSnap] = useState<WorkspaceSourceBlocks | null>(null);
  const [sourcesFlash, setSourcesFlash] = useState(false);
  const [expertViewMode, setExpertViewMode] = useState(false);
  const [expertSnap, setExpertSnap] = useState({ iriss: "", apskatesPlāns: "", cenasAtbilstiba: "" });
  const [expertFlash, setExpertFlash] = useState(false);
  const [portfolioPortalEl, setPortfolioPortalEl] = useState<HTMLElement | null>(null);
  const [portfolioAllFilesModalOpen, setPortfolioAllFilesModalOpen] = useState(false);
  const [workspaceAutosaveFlash, setWorkspaceAutosaveFlash] = useState(false);
  const [workspaceSaveServerOk, setWorkspaceSaveServerOk] = useState(true);
  const [portfolioPersistFlash, setPortfolioPersistFlash] = useState(false);
  const [portfolioUploadNotice, setPortfolioUploadNotice] = useState<string | null>(null);
  const [portfolioDropActive, setPortfolioDropActive] = useState(false);
  const portfolioDragDepth = useRef(0);
  const skipWorkspaceAutosaveFlash = useRef(true);
  const wsPersistRef = useRef(ws);
  wsPersistRef.current = ws;
  const portfolioBytes = useMemo(() => portfolio.reduce((a, p) => a + p.size, 0), [portfolio]);

  const narrowPortfolioLayout = Boolean(portfolioPortalDomId);

  useLayoutEffect(() => {
    if (!portfolioPortalDomId || typeof document === "undefined") {
      setPortfolioPortalEl(null);
      return;
    }
    setPortfolioPortalEl(document.getElementById(portfolioPortalDomId));
  }, [portfolioPortalDomId, payload.sessionId]);

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

  const previewAnalysis = useMemo(
    () =>
      analyzeVinAndKm({
        orderVin: payload.vin,
        blocks: SOURCE_BLOCK_KEYS.map((key) => ({
          label: SOURCE_BLOCK_LABELS[key],
          text:
            key === "csdd"
              ? csddFormToPlainText(ws.sourceBlocks.csdd)
              : key === "ltab"
                ? ltabBlockToPlainText(ws.sourceBlocks.ltab)
                : key === "tirgus"
                  ? tirgusFormToPlainText(ws.sourceBlocks.tirgus)
                  : key === "citi_avoti"
                    ? citiAvotiToPlainText(ws.sourceBlocks.citi_avoti)
                    : key === "listing_analysis"
                      ? listingAnalysisToPlainText(ws.sourceBlocks.listing_analysis)
                      : key === "auto_records"
                        ? autoRecordsBlockToPlainText(ws.sourceBlocks.auto_records)
                        : key === "autodna" || key === "carvertical"
                          ? vendorAvotuBlockToPlainText(ws.sourceBlocks[key])
                          : standardBlockToPlainText(ws.sourceBlocks[key]),
        })),
        fileNames: portfolio.map((p) => p.name),
      }),
    [payload.vin, ws.sourceBlocks, portfolio],
  );

  const updateWs = useCallback((patch: Partial<WorkspacePersist>) => {
    setWs((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateSourceBlock = useCallback((key: SourceBlockKey, block: WorkspaceSourceBlocks[SourceBlockKey]) => {
    setWs((prev) => ({
      ...prev,
      sourceBlocks: { ...prev.sourceBlocks, [key]: block },
    }));
  }, []);

  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);

  useEffect(() => {
    setWorkspaceHydrated(false);
    try {
      if (serverWorkspaceJson) {
        const fromServer = hydrateWorkspaceFromStorage(serverWorkspaceJson);
        if (fromServer) {
          setWs({
            sourceBlocks: fromServer.sourceBlocks,
            iriss: fromServer.iriss,
            apskatesPlāns: fromServer.apskatesPlāns,
            cenasAtbilstiba: fromServer.cenasAtbilstiba,
            previewConfirmed: Boolean(fromServer.previewConfirmed),
          });
          const keyV3 = storageKeyWorkspace(payload.sessionId);
          try {
            localStorage.setItem(keyV3, serverWorkspaceJson);
            const leg = localStorage.getItem(storageKeyInternalLegacy(payload.sessionId));
            if (leg) localStorage.removeItem(storageKeyInternalLegacy(payload.sessionId));
          } catch {
            /* quota */
          }
          setWorkspaceHydrated(true);
          return;
        }
      }
      const keyV3 = storageKeyWorkspace(payload.sessionId);
      const keyV2 = `${LEGACY_WORKSPACE_V2_PREFIX}${payload.sessionId}`;
      const raw = localStorage.getItem(keyV3) ?? localStorage.getItem(keyV2);
      if (raw) {
        const h = hydrateWorkspaceFromStorage(raw);
        if (h) {
          setWs({
            sourceBlocks: h.sourceBlocks,
            iriss: h.iriss,
            apskatesPlāns: h.apskatesPlāns,
            cenasAtbilstiba: h.cenasAtbilstiba,
            previewConfirmed: Boolean(h.previewConfirmed),
          });
          if (!localStorage.getItem(keyV3) && localStorage.getItem(keyV2)) {
            try {
              localStorage.setItem(
                keyV3,
                JSON.stringify({
                  sourceBlocks: h.sourceBlocks,
                  iriss: h.iriss,
                  apskatesPlāns: h.apskatesPlāns,
                  cenasAtbilstiba: h.cenasAtbilstiba,
                  previewConfirmed: h.previewConfirmed,
                }),
              );
            } catch {
              /* quota */
            }
          }
        } else {
          setWs(EMPTY_WORKSPACE);
        }
      } else {
        const legacy = localStorage.getItem(storageKeyInternalLegacy(payload.sessionId));
        const serverC = payload.serverInternalComment?.trim();
        if (legacy || serverC) {
          const b = createDefaultSourceBlocks();
          const parts: string[] = [];
          if (serverC) parts.push(serverC);
          if (legacy) parts.push(legacy);
          b.autodna = { ...emptyVendorAvotuBlock(), comments: parts.join("\n\n") };
          setWs({ ...EMPTY_WORKSPACE, sourceBlocks: b, previewConfirmed: false });
        } else {
          setWs(EMPTY_WORKSPACE);
        }
      }
    } catch {
      setWs(EMPTY_WORKSPACE);
    }
    setWorkspaceHydrated(true);
  }, [payload.sessionId, payload.serverInternalComment, serverWorkspaceJson]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    setSourcesSnap(null);
    setSourcesViewMode(false);
    setExpertSnap({ iriss: ws.iriss, apskatesPlāns: ws.apskatesPlāns, cenasAtbilstiba: ws.cenasAtbilstiba });
    setExpertViewMode(false);
  }, [workspaceHydrated, payload.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps -- tikai sesija / hidrācija

  useEffect(() => {
    skipWorkspaceAutosaveFlash.current = true;
  }, [payload.sessionId]);

  const flushWorkspaceToLocalStorage = useCallback(() => {
    if (!workspaceHydrated) return;
    try {
      const cur = wsPersistRef.current;
      localStorage.setItem(storageKeyWorkspace(payload.sessionId), JSON.stringify(cur));
      const leg = localStorage.getItem(storageKeyInternalLegacy(payload.sessionId));
      if (leg) localStorage.removeItem(storageKeyInternalLegacy(payload.sessionId));
    } catch {
      /* quota */
    }
  }, [workspaceHydrated, payload.sessionId]);

  useEffect(() => {
    const onUnload = () => flushWorkspaceToLocalStorage();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [flushWorkspaceToLocalStorage]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    const t = window.setTimeout(() => {
      void (async () => {
        flushWorkspaceToLocalStorage();
        let srvOk = !orderDraftPersistenceEnabled;
        if (orderDraftPersistenceEnabled) {
          const cur = wsPersistRef.current;
          try {
            const res = await fetch("/api/admin/order-draft", {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: payload.sessionId,
                workspace: {
                  sourceBlocks: cur.sourceBlocks,
                  iriss: cur.iriss,
                  apskatesPlāns: cur.apskatesPlāns,
                  cenasAtbilstiba: cur.cenasAtbilstiba,
                  previewConfirmed: cur.previewConfirmed,
                },
              }),
            });
            srvOk = res.ok;
          } catch {
            srvOk = false;
          }
        }
        if (skipWorkspaceAutosaveFlash.current) {
          skipWorkspaceAutosaveFlash.current = false;
        } else {
          setWorkspaceSaveServerOk(srvOk);
          setWorkspaceAutosaveFlash(true);
        }
      })();
    }, 750);
    return () => window.clearTimeout(t);
  }, [ws, workspaceHydrated, payload.sessionId, flushWorkspaceToLocalStorage, orderDraftPersistenceEnabled]);

  useEffect(() => {
    if (!workspaceAutosaveFlash) return;
    const u = window.setTimeout(() => setWorkspaceAutosaveFlash(false), 1400);
    return () => window.clearTimeout(u);
  }, [workspaceAutosaveFlash]);

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

  const canGeneratePdf =
    ws.previewConfirmed && ws.iriss.trim().length > 0 && ws.cenasAtbilstiba.trim().length > 0;

  const blocksForDisplay =
    sourcesViewMode && sourcesSnap ? sourcesSnap : ws.sourceBlocks;

  const openPrintReport = async () => {
    if (!canGeneratePdf) {
      alert(
        "Vispirms: 1) aizpildi avotu laukus un pievieno failus, 2) atver Priekšskatu un apstiprini, 3) aizpildi kopsavilkumu un lauku \"Cenas atbilstība balstoties uz mūsu rīcībā esošajiem datiem\". Tad ģenerē PDF.",
      );
      return;
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
    const flatSources = blocksToLegacyFlatFields(ws.sourceBlocks);
    const html = buildClientReportDocumentHtml({
      payload: {
        ...payload,
        ...flatSources,
        csddForm: ws.sourceBlocks.csdd,
        tirgusForm: ws.sourceBlocks.tirgus,
        manualVendorBlocks: toPdfManualVendorBlocks(ws.sourceBlocks),
        manualLtabBlock: toPdfLtabManualBlock(ws.sourceBlocks.ltab),
        autoRecordsBlock: ws.sourceBlocks.auto_records,
        citiAvoti: ws.sourceBlocks.citi_avoti,
        listingAnalysis: ws.sourceBlocks.listing_analysis,
        iriss: ws.iriss,
        apskatesPlāns: ws.apskatesPlāns,
        cenasAtbilstiba: ws.cenasAtbilstiba,
        listingMarket,
      },
      portfolio: portfolio.map((p) => ({ name: p.name, size: p.size })),
      pdfInsights,
      dateFmt,
      formatBytes,
    });

    const w = window.open("", "_blank");
    if (!w) {
      alert("Atļauj uznirstošo logu, lai atvērtu druku.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const previewBody = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => setPreviewOpen(false)}
    >
      <div
        className="max-h-[90vh] w-full max-w-[min(96rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[var(--color-apple-text)]">Priekšskats — apkopota informācija</h3>
        <p className="mt-1.5 text-sm leading-snug text-[var(--color-provin-muted)]">
          Secība: <strong className="text-[var(--color-apple-text)]">1)</strong> portfeļa faili,{" "}
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
                text={
                  key === "csdd"
                    ? csddFormToPlainText(ws.sourceBlocks.csdd)
                    : key === "ltab"
                      ? ltabBlockToPlainText(ws.sourceBlocks.ltab)
                      : key === "tirgus"
                        ? tirgusFormToPlainText(ws.sourceBlocks.tirgus)
                        : key === "citi_avoti"
                          ? citiAvotiToPlainText(ws.sourceBlocks.citi_avoti)
                          : key === "listing_analysis"
                            ? listingAnalysisToPlainText(ws.sourceBlocks.listing_analysis)
                            : key === "auto_records"
                              ? autoRecordsBlockToPlainText(ws.sourceBlocks.auto_records)
                              : key === "autodna" || key === "carvertical"
                                ? vendorAvotuBlockToPlainText(ws.sourceBlocks[key])
                                : standardBlockToPlainText(ws.sourceBlocks[key])
                }
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
    <section className={portfolioShellClass}>
      <div
        className={`flex gap-1 ${narrowPortfolioLayout ? "flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" : "flex-wrap items-center justify-between"}`}
      >
        <h2 className={`${workspaceSectionTitle} flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-0`}>
          <span>1. Portfelis</span>
          {portfolioPersistFlash ? (
            <span className="text-[10px] font-semibold normal-case tracking-normal text-emerald-700" role="status">
              Saglabāts
            </span>
          ) : null}
        </h2>
      </div>
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
        className={`mt-1 min-w-0 rounded-lg border border-dashed px-1.5 py-1.5 transition-colors ${
          portfolioDropActive
            ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/35"
            : "border-transparent"
        } ${narrowPortfolioLayout ? "flex flex-col gap-1" : "flex flex-wrap items-center gap-x-3 gap-y-0.5"}`}
      >
        <p
          className={`text-[10px] leading-tight text-[var(--color-provin-muted)] ${narrowPortfolioLayout ? "" : "max-w-[min(100%,28rem)]"}`}
        >
          PDF IndexedDB — augšupielāde un saglabāšana <strong className="text-[var(--color-apple-text)]">uzreiz</strong>{" "}
          pēc izvēles vai nometšanas.
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
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3"
        role="presentation"
        onClick={() => setPortfolioAllFilesModalOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="portfolio-all-files-title"
          className="flex max-h-[min(85dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
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

  return (
    <div className="space-y-1.5">
      {previewOpen ? previewBody : null}

      {portfolioAllFilesModal != null && typeof document !== "undefined"
        ? createPortal(portfolioAllFilesModal, document.body)
        : null}

      {showPortfolioPortal ? createPortal(portfolioSection, portfolioPortalEl!) : null}

      <details className="group rounded-lg border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white px-2.5 py-2 shadow-sm open:shadow-md">
        <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--color-apple-text)] marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            Darba secība
            <span className="text-[11px] font-normal text-[var(--color-provin-muted)] group-open:hidden">(atvērt)</span>
          </span>
        </summary>
        <div className="mt-1.5 space-y-1 border-t border-slate-200/80 pt-1.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
          <ol className="list-decimal space-y-0.5 pl-3.5">
            <li>Portfelis → avoti → sludinājuma analīze → priekšskats → kopsavilkums un apskates plāns → PDF.</li>
            <li>
              Avotu bloki: CSDD pilnā platumā, tad divas 3 kolonnu rindas (AutoDNA–CarVertical–Auto-Records;
              LTAB–Tirgus–Citi avoti). Sludinājuma analīze ir atsevišķs bloks. PDF: Avotu dati → Sludinājuma
              analīze → APPROVED BY IRISS (noslēgums). Tukši lauki PDF netiek drukāti.
            </li>
            <li>Dati: localStorage + IndexedDB.</li>
          </ol>
        </div>
      </details>

      {showPortfolioInline ? portfolioSection : null}

      <section className={workspaceSectionShell}>
        <div className="flex flex-wrap items-start justify-between gap-1.5">
          <div className="min-w-0">
            <h2 className={`${workspaceSectionTitle} flex flex-wrap items-baseline gap-x-2 gap-y-0`}>
              <span>2. Avotu bloki</span>
              {workspaceAutosaveFlash ? (
                <span
                  className={`text-[10px] font-semibold normal-case tracking-normal ${
                    orderDraftPersistenceEnabled && !workspaceSaveServerOk ? "text-amber-800" : "text-emerald-700"
                  }`}
                  role="status"
                >
                  {!orderDraftPersistenceEnabled
                    ? "Saglabāts"
                    : workspaceSaveServerOk
                      ? "Saglabāts serverī"
                      : "Saglabāts lokāli (serveris nav pieejams)"}
                </span>
              ) : null}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {sourcesFlash ? (
              <span className="text-[11px] font-semibold text-emerald-700" role="status">
                Saglabāts
              </span>
            ) : null}
            <button
              type="button"
              className={workspaceToolbarBtn}
              onClick={() => {
                setSourcesSnap(JSON.parse(JSON.stringify(ws.sourceBlocks)) as WorkspaceSourceBlocks);
                setSourcesViewMode(true);
                setSourcesFlash(true);
                window.setTimeout(() => setSourcesFlash(false), 2000);
              }}
            >
              Saglabāt
            </button>
            <button type="button" className={workspaceToolbarBtn} onClick={() => setSourcesViewMode(false)}>
              Labot
            </button>
          </div>
        </div>
        <div className="mt-1.5 flex flex-col gap-2">
          <div className="w-full min-w-0">
            <AdminCsddSourceBlock
              value={blocksForDisplay.csdd}
              readOnly={sourcesViewMode}
              onChange={(next) => updateSourceBlock("csdd", next)}
            />
          </div>
          <div className="grid min-h-0 min-w-0 grid-cols-3 gap-2 items-stretch">
            <div className="flex min-h-0 h-full min-w-0 flex-col">
              <AdminVendorAvotuSourceBlock
                blockKey="autodna"
                value={blocksForDisplay.autodna}
                readOnly={sourcesViewMode}
                onChange={(next) => updateSourceBlock("autodna", next)}
              />
            </div>
            <div className="flex min-h-0 h-full min-w-0 flex-col">
              <AdminVendorAvotuSourceBlock
                blockKey="carvertical"
                value={blocksForDisplay.carvertical}
                readOnly={sourcesViewMode}
                onChange={(next) => updateSourceBlock("carvertical", next)}
              />
            </div>
            <div className="flex min-h-0 h-full min-w-0 flex-col">
              <AdminAutoRecordsSourceBlock
                value={blocksForDisplay.auto_records}
                readOnly={sourcesViewMode}
                onChange={(next) => updateSourceBlock("auto_records", next)}
              />
            </div>
          </div>
          <div className="grid min-h-0 min-w-0 grid-cols-3 gap-2 items-stretch">
            <div className="flex min-h-0 h-full min-w-0 flex-col">
              <AdminLtabSourceBlock
                value={blocksForDisplay.ltab}
                readOnly={sourcesViewMode}
                onChange={(next) => updateSourceBlock("ltab", next)}
              />
            </div>
            <div className="flex min-h-0 h-full min-w-0 flex-col">
              <AdminTirgusSourceBlock
                value={blocksForDisplay.tirgus}
                readOnly={sourcesViewMode}
                onChange={(next) => updateSourceBlock("tirgus", next)}
              />
            </div>
            <div className="flex min-h-0 h-full min-w-0 flex-col">
              <AdminCitiAvotiSourceBlock
                value={blocksForDisplay.citi_avoti}
                readOnly={sourcesViewMode}
                onChange={(next) => updateSourceBlock("citi_avoti", next)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="min-w-0">
        <h2 className={workspaceSectionTitle}>3. Sludinājuma analīze</h2>
        <p className="mt-0.5 text-[10px] leading-snug text-[var(--color-provin-muted)]">
          Lasīšanas / labošanas režīms kopīgs ar 2. sadaļas rīkjoslu (Saglabāt / Labot).
        </p>
        <div className="mt-1.5 overflow-hidden rounded-lg border border-[#cfe8d4] shadow-[0_4px_14px_rgba(46,125,50,0.1)]">
          <AdminGradientHeaderBar
            gradient={SOURCE_BLOCK_HEADER_BG.listing_analysis}
            className="rounded-t-lg"
            contentClassName="gap-2 px-3 py-2.5"
          >
            <svg
              className="h-4 w-4 shrink-0 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                strokeLinejoin="round"
                d="m12 3 1.6 5.2h5.4l-4.4 3.4 1.7 5.4L12 15.8 7.7 17.2l1.7-5.4L5 8.2h5.4L12 3z"
              />
            </svg>
            <span className="text-[11px] font-bold tracking-[0.12em] text-white">SLUDINĀJUMA ANALĪZE</span>
          </AdminGradientHeaderBar>
          <div
            className="p-2.5"
            style={{ background: LISTING_ANALYSIS_BODY_BG, WebkitPrintColorAdjust: "exact" }}
          >
            <AdminListingAnalysisSourceBlock
              value={blocksForDisplay.listing_analysis}
              readOnly={sourcesViewMode}
              onChange={(next) => updateSourceBlock("listing_analysis", next)}
              variant="priority"
            />
          </div>
        </div>

        <div className="mt-1.5 border-t border-slate-200/80 pt-1.5">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex rounded-full border border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-provin-accent)] hover:bg-[#d4e8fb]"
          >
            Priekšskats
          </button>
          {ws.previewConfirmed ? (
            <p className="mt-1 text-[11px] font-medium text-emerald-800">Apstiprināts — vari rakstīt kopsavilkumu.</p>
          ) : (
            <p className="mt-1 text-[11px] text-[var(--color-provin-muted)]">Apstiprini modālī.</p>
          )}
        </div>
      </section>

      <section className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-1.5">
          <div className="min-w-0">
            <h2 className={`${workspaceSectionTitle} flex flex-wrap items-baseline gap-x-2 gap-y-0`}>
              <span>4. Kopsavilkums un apskates plāns</span>
              {workspaceAutosaveFlash ? (
                <span
                  className={`text-[10px] font-semibold normal-case tracking-normal ${
                    orderDraftPersistenceEnabled && !workspaceSaveServerOk ? "text-amber-800" : "text-emerald-700"
                  }`}
                  role="status"
                >
                  {!orderDraftPersistenceEnabled
                    ? "Saglabāts"
                    : workspaceSaveServerOk
                      ? "Saglabāts serverī"
                      : "Saglabāts lokāli (serveris nav pieejams)"}
                </span>
              ) : null}
            </h2>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--color-provin-muted)]">
              Viens <strong className="text-[var(--color-apple-text)]">Saglabāt</strong> abiem laukiem.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {expertFlash ? (
              <span className="text-[11px] font-semibold text-emerald-700" role="status">
                Saglabāts
              </span>
            ) : null}
            <button
              type="button"
              className={workspaceToolbarBtn}
              disabled={!ws.previewConfirmed}
              onClick={() => {
                setExpertSnap({
                  iriss: ws.iriss,
                  apskatesPlāns: ws.apskatesPlāns,
                  cenasAtbilstiba: ws.cenasAtbilstiba,
                });
                setExpertViewMode(true);
                setExpertFlash(true);
                window.setTimeout(() => setExpertFlash(false), 2000);
              }}
            >
              Saglabāt
            </button>
            <button
              type="button"
              className={workspaceToolbarBtn}
              disabled={!ws.previewConfirmed}
              onClick={() => setExpertViewMode(false)}
            >
              Labot
            </button>
          </div>
        </div>
        <div
          className={`mt-1.5 overflow-hidden rounded-lg border border-sky-200/70 shadow-[0_8px_24px_rgba(15,23,42,0.1)] ${
            ws.previewConfirmed ? "" : "opacity-[0.88]"
          }`}
        >
          <AdminGradientHeaderBar
            gradient={APPROVED_BY_IRISS_HEADER_BG}
            className="rounded-t-lg"
            contentClassName="gap-2 px-3 py-2.5"
          >
            <svg
              className="h-4 w-4 shrink-0 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              />
            </svg>
            <span className="text-[11px] font-bold tracking-[0.12em] text-white">APPROVED BY IRISS</span>
          </AdminGradientHeaderBar>
          <div className="p-2.5" style={{ background: APPROVED_BY_IRISS_BODY_BG }}>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-apple-text)]">
              KOPSAVILKUMS UN APSKATES PLĀNS
            </h3>
            <div className="space-y-2">
              {expertViewMode ? (
                <div className={`${bulkReadonlyClass} min-h-[200px] max-h-[min(70vh,560px)] overflow-y-auto whitespace-pre-wrap`}>
                  {expertSnap.iriss.trim() ? expertSnap.iriss : <span className="text-slate-400">—</span>}
                </div>
              ) : (
                <textarea
                  id={`${fileInputId}-iriss`}
                  className={`${bulkTextareaClass} min-h-[200px] max-h-[min(70vh,560px)] resize-y bg-white/90`}
                  value={ws.iriss}
                  onChange={(e) => updateWs({ iriss: e.target.value })}
                  placeholder="Galvenais kopsavilkums klientam…"
                  spellCheck
                  disabled={!ws.previewConfirmed}
                />
              )}
              {expertViewMode ? (
                <div className={`${bulkReadonlyClass} min-h-[100px] max-h-[min(50vh,400px)] overflow-y-auto whitespace-pre-wrap`}>
                  {expertSnap.apskatesPlāns.trim() ? (
                    expertSnap.apskatesPlāns
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              ) : (
                <textarea
                  id={`${fileInputId}-apskates`}
                  className={`${bulkTextareaClass} min-h-[100px] max-h-[min(50vh,400px)] resize-y bg-white/90`}
                  value={ws.apskatesPlāns}
                  onChange={(e) => updateWs({ apskatesPlāns: e.target.value })}
                  placeholder="Apskates plāns klātienē — piem. [ ] Aizmugure — krāsas biezums… · [ ] Stūre — vibrācijas…"
                  spellCheck
                  disabled={!ws.previewConfirmed}
                />
              )}
              {expertViewMode ? (
                <div className={`${bulkReadonlyClass} min-h-[80px] max-h-[min(40vh,320px)] overflow-y-auto whitespace-pre-wrap`}>
                  {expertSnap.cenasAtbilstiba.trim() ? (
                    expertSnap.cenasAtbilstiba
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              ) : (
                <textarea
                  id={`${fileInputId}-cenas-atbilstiba`}
                  className={`${bulkTextareaClass} min-h-[80px] max-h-[min(40vh,320px)] resize-y bg-white/90`}
                  value={ws.cenasAtbilstiba}
                  onChange={(e) => updateWs({ cenasAtbilstiba: e.target.value })}
                  placeholder="Cenas atbilstība balstoties uz mūsu rīcībā esošajiem datiem:"
                  spellCheck
                  disabled={!ws.previewConfirmed}
                />
              )}
            </div>
          </div>
        </div>
        {!ws.previewConfirmed ? (
          <p className="mt-1 text-[11px] text-amber-800">Vispirms apstiprini priekšskatu.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-[var(--color-provin-accent)]/30 bg-[var(--color-provin-accent-soft)]/50 p-2 shadow-sm">
        <h2 className={workspaceSectionTitle}>5. PDF klientam</h2>
        <p className="mt-0.5 text-[10px] leading-tight text-[var(--color-provin-muted)]">
          Pēc kopsavilkuma aizpildes — druka / saglabāt kā PDF.
        </p>
        <button
          type="button"
          onClick={openPrintReport}
          disabled={!canGeneratePdf}
          className={`${workspaceToolbarBtn} mt-1 border border-slate-400/90 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45`}
        >
          Ģenerēt PDF
        </button>
        {!canGeneratePdf ? (
          <p className="mt-1 text-[11px] text-[var(--color-provin-muted)]">
            Vajag apstiprinātu priekšskatu, kopsavilkumu un cenas atbilstības komentāru.
          </p>
        ) : null}
      </section>
    </div>
  );
}

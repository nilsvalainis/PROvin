"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AdminSavablePortfolioFileRow } from "@/components/admin/AdminSavablePortfolioFileRow";
import { AdminStructuredSourceBlock } from "@/components/admin/AdminStructuredSourceBlock";
import {
  SOURCE_BLOCK_KEYS,
  SOURCE_BLOCK_LABELS,
  blockToPlainText,
  blocksToLegacyFlatFields,
  createDefaultSourceBlocks,
  emptyDataRow,
  hydrateWorkspaceFromStorage,
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
  previewConfirmed: boolean;
};

const EMPTY_WORKSPACE: WorkspacePersist = {
  sourceBlocks: createDefaultSourceBlocks(),
  iriss: "",
  apskatesPlāns: "",
  previewConfirmed: false,
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;

const workspaceToolbarBtn =
  "rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-semibold tracking-tight text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

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
}: {
  payload: OrderWorkspacePayload;
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
  const [expertSnap, setExpertSnap] = useState({ iriss: "", apskatesPlāns: "" });
  const [expertFlash, setExpertFlash] = useState(false);
  const portfolioBytes = useMemo(() => portfolio.reduce((a, p) => a + p.size, 0), [portfolio]);

  const mergedKmPoints = useMemo(() => mergeKmForChart(pdfInsights), [pdfInsights]);

  const previewAnalysis = useMemo(
    () =>
      analyzeVinAndKm({
        orderVin: payload.vin,
        blocks: SOURCE_BLOCK_KEYS.map((key) => ({
          label: SOURCE_BLOCK_LABELS[key],
          text: blockToPlainText(ws.sourceBlocks[key]),
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

  const workspaceFieldResetKey = `${payload.sessionId}-${workspaceHydrated ? 1 : 0}`;

  const reloadPortfolioFromIdb = useCallback(async () => {
    setFileError(null);
    portfolioRef.current.forEach((p) => URL.revokeObjectURL(p.blobUrl));
    try {
      await migrateLegacyPortfolioFromLocalStorage(payload.sessionId);
      const stored = await idbGetPortfolio(payload.sessionId);
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
      setPortfolio(ui);
    } catch {
      setFileError("Neizdevās pārlādēt portfeli no IndexedDB.");
    }
  }, [payload.sessionId]);

  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);

  useEffect(() => {
    setWorkspaceHydrated(false);
    try {
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
          b.autodna = { rows: [emptyDataRow()], comments: parts.join("\n\n") };
          setWs({ ...EMPTY_WORKSPACE, sourceBlocks: b, previewConfirmed: false });
        } else {
          setWs(EMPTY_WORKSPACE);
        }
      }
    } catch {
      setWs(EMPTY_WORKSPACE);
    }
    setWorkspaceHydrated(true);
  }, [payload.sessionId, payload.serverInternalComment]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    setSourcesSnap(null);
    setSourcesViewMode(false);
    setExpertSnap({ iriss: ws.iriss, apskatesPlāns: ws.apskatesPlāns });
    setExpertViewMode(false);
  }, [workspaceHydrated, payload.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps -- tikai sesija / hidrācija

  useEffect(() => {
    if (!workspaceHydrated) return;
    try {
      localStorage.setItem(storageKeyWorkspace(payload.sessionId), JSON.stringify(ws));
      const leg = localStorage.getItem(storageKeyInternalLegacy(payload.sessionId));
      if (leg) localStorage.removeItem(storageKeyInternalLegacy(payload.sessionId));
    } catch {
      /* quota */
    }
  }, [workspaceHydrated, ws, payload.sessionId]);

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
    async (next: PortfolioEntry[]) => {
      setPortfolio(next);
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
        setFileError(null);
      } catch {
        setFileError(
          "Neizdevās saglabāt portfeli IndexedDB. Ja kvota joprojām pilna, noņem dažus failus vai izmanto mazākus PDF.",
        );
      }
    },
    [payload.sessionId],
  );

  const onPickFiles = async (files: FileList | null) => {
    setFileError(null);
    if (!files?.length) return;
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
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        mime,
        addedAt: new Date().toISOString(),
        blobUrl,
      });
    }
    await persistPortfolio(next);
  };

  const removePortfolio = (id: string) => {
    const victim = portfolio.find((p) => p.id === id);
    if (victim) URL.revokeObjectURL(victim.blobUrl);
    void persistPortfolio(portfolio.filter((p) => p.id !== id));
  };

  const canGeneratePdf = ws.previewConfirmed && ws.iriss.trim().length > 0;

  const blocksForDisplay =
    sourcesViewMode && sourcesSnap ? sourcesSnap : ws.sourceBlocks;

  const openPrintReport = async () => {
    if (!canGeneratePdf) {
      alert(
        "Vispirms: 1) aizpildi avotu laukus un pievieno failus, 2) atver Priekšskatu un apstiprini, 3) ieraksti IRISS komentāru. Tad ģenerē PDF.",
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
        manualVendorBlocks: toPdfManualVendorBlocks(ws.sourceBlocks),
        iriss: ws.iriss,
        apskatesPlāns: ws.apskatesPlāns,
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
                text={blockToPlainText(ws.sourceBlocks[key])}
                variant={key === "tirgus" ? "tirgus" : "default"}
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
            Apstiprinu — turpināt uz IRISS komentāru
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {previewOpen ? previewBody : null}

      <details className="group rounded-lg border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white px-2.5 py-2 shadow-sm open:shadow-md">
        <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--color-apple-text)] marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            Darba secība
            <span className="text-[11px] font-normal text-[var(--color-provin-muted)] group-open:hidden">(atvērt)</span>
          </span>
        </summary>
        <div className="mt-1.5 space-y-1 border-t border-slate-200/80 pt-1.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
          <ol className="list-decimal space-y-0.5 pl-3.5">
            <li>Portfelis → avoti → priekšskats → IRISS + apskates plāns → PDF.</li>
            <li>Tukši avotu bloki PDF netiek iekļauti.</li>
            <li>Dati: localStorage + IndexedDB.</li>
          </ol>
        </div>
      </details>

      <section className="rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-apple-text)]">
            1. Portfelis
          </h2>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className={workspaceToolbarBtn}
              onClick={() => void persistPortfolio(portfolio)}
            >
              Saglabāt
            </button>
            <button type="button" className={workspaceToolbarBtn} onClick={() => void reloadPortfolioFromIdb()}>
              Labot
            </button>
          </div>
        </div>
        <p className="mt-0.5 text-[10px] leading-snug text-[var(--color-provin-muted)]">
          PDF IndexedDB · <strong className="text-[var(--color-apple-text)]">Saglabāt</strong> /{" "}
          <strong className="text-[var(--color-apple-text)]">Labot</strong> pie rindas.
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            id={fileInputId}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <label
            htmlFor={fileInputId}
            className={`${workspaceToolbarBtn} inline-flex cursor-pointer`}
          >
            Pievienot failus…
          </label>
          <span className="text-[10px] leading-snug text-[var(--color-provin-muted)]">
            līdz {formatBytes(MAX_FILE_BYTES)} / fails, kopā ~{formatBytes(MAX_TOTAL_BYTES)} (
            {formatBytes(Math.round(portfolioBytes))})
          </span>
        </div>
        {fileError ? <p className="mt-1.5 text-[11px] text-amber-800">{fileError}</p> : null}
        {portfolio.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {portfolio.map((p, i) => (
              <AdminSavablePortfolioFileRow
                key={p.id}
                index={i}
                file={p}
                formatBytes={formatBytes}
                onPersistAll={() => persistPortfolio(portfolio)}
                onRemove={() => removePortfolio(p.id)}
                resetVersion={workspaceFieldResetKey}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
            Vēl nav pievienotu failu.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-apple-text)]">
              2. Avotu bloki
            </h2>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--color-provin-muted)]">
              Katrā blokā: <strong className="text-[var(--color-apple-text)]">datums · km · bojājumu summa</strong> (rindas{" "}
              <strong className="text-[var(--color-apple-text)]">+</strong>), tad <strong>komentāri</strong>. Tukši bloki PDF
              netiek drukāti. Viens <strong className="text-[var(--color-apple-text)]">Saglabāt</strong> visiem.
            </p>
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
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCE_BLOCK_KEYS.map((key) => (
            <AdminStructuredSourceBlock
              key={key}
              blockKey={key}
              value={blocksForDisplay[key]}
              readOnly={sourcesViewMode}
              onChange={(next) => updateSourceBlock(key, next)}
            />
          ))}
        </div>

        <div className="mt-2 border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex rounded-full border border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-provin-accent)] hover:bg-[#d4e8fb]"
          >
            Priekšskats
          </button>
          {ws.previewConfirmed ? (
            <p className="mt-1.5 text-[11px] font-medium text-emerald-800">Apstiprināts — vari rakstīt IRISS.</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-[var(--color-provin-muted)]">Apstiprini modālī.</p>
          )}
        </div>
      </section>

      <section
        className={`rounded-lg border p-2.5 shadow-sm ${
          ws.previewConfirmed
            ? "border-slate-200/80 bg-white"
            : "border-dashed border-slate-200 bg-slate-50/50"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-apple-text)]">
              3. IRISS + apskates plāns
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
                setExpertSnap({ iriss: ws.iriss, apskatesPlāns: ws.apskatesPlāns });
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
        <div className="mt-1.5 space-y-2">
          <div>
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
              IRISS (eksperta slēdziens)
            </div>
            {expertViewMode ? (
              <div className={`${bulkReadonlyClass} min-h-[200px] max-h-[min(70vh,560px)] overflow-y-auto`}>
                {expertSnap.iriss.trim() ? expertSnap.iriss : <span className="text-slate-400">—</span>}
              </div>
            ) : (
              <textarea
                id={`${fileInputId}-iriss`}
                className={`${bulkTextareaClass} min-h-[200px] max-h-[min(70vh,560px)] resize-y`}
                value={ws.iriss}
                onChange={(e) => updateWs({ iriss: e.target.value })}
                placeholder="Galvenais kopsavilkums klientam…"
                spellCheck
                disabled={!ws.previewConfirmed}
              />
            )}
          </div>
          <div>
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
              Apskates plāns (klātienē)
            </div>
            {expertViewMode ? (
              <div className={`${bulkReadonlyClass} min-h-[100px] max-h-[min(50vh,400px)] overflow-y-auto`}>
                {expertSnap.apskatesPlāns.trim() ? (
                  expertSnap.apskatesPlāns
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            ) : (
              <textarea
                id={`${fileInputId}-apskates`}
                className={`${bulkTextareaClass} min-h-[100px] max-h-[min(50vh,400px)] resize-y`}
                value={ws.apskatesPlāns}
                onChange={(e) => updateWs({ apskatesPlāns: e.target.value })}
                placeholder="Piem. [ ] Aizmugure — krāsas biezums… · [ ] Stūre — vibrācijas…"
                spellCheck
                disabled={!ws.previewConfirmed}
              />
            )}
          </div>
        </div>
        {!ws.previewConfirmed ? (
          <p className="mt-1.5 text-[11px] text-amber-800">Vispirms apstiprini priekšskatu.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-[var(--color-provin-accent)]/30 bg-[var(--color-provin-accent-soft)]/50 p-2.5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-apple-text)]">4. PDF klientam</h2>
        <p className="mt-0.5 text-[10px] leading-snug text-[var(--color-provin-muted)]">
          Pēc IRISS aizpildes — druka / saglabāt kā PDF.
        </p>
        <button
          type="button"
          onClick={openPrintReport}
          disabled={!canGeneratePdf}
          className={`${workspaceToolbarBtn} mt-1.5 bg-[var(--color-provin-accent)] text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45`}
        >
          Ģenerēt PDF
        </button>
        {!canGeneratePdf ? (
          <p className="mt-1.5 text-[11px] text-[var(--color-provin-muted)]">Vajag apstiprinātu priekšskatu + IRISS.</p>
        ) : null}
      </section>
    </div>
  );
}

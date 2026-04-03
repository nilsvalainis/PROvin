"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AdminSavablePortfolioFileRow } from "@/components/admin/AdminSavablePortfolioFileRow";
import { AdminSavableTextField } from "@/components/admin/AdminSavableTextField";
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
  workspaceBlockToHtml,
  type PreviewSegment,
  type SegmentOptions,
} from "@/lib/admin-workspace-preview-format";
import {
  analyzePdfBuffer,
  mergeKmForChart,
  type PdfPortfolioFileInsight,
} from "@/lib/admin-portfolio-pdf-analysis";
import {
  CLIENT_REPORT_FOOTER_DISCLAIMER,
  CLIENT_REPORT_SECTION_LABELS,
  CLIENT_REPORT_SERVICE_NOTICE,
  REPORT_PDF_STANDARDS,
  sanitizeAttachmentFileNameForReport,
} from "@/lib/report-pdf-standards";

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
  csdd: string;
  ltab: string;
  tirgus: string;
  citi: string;
  iriss: string;
  previewConfirmed: boolean;
};

const EMPTY_WORKSPACE: WorkspacePersist = {
  csdd: "",
  ltab: "",
  tirgus: "",
  citi: "",
  iriss: "",
  previewConfirmed: false,
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;

const workspaceToolbarBtn =
  "rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-semibold tracking-tight text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

function storageKeyWorkspace(sessionId: string) {
  return `provin-admin-workspace-v2-${sessionId}`;
}

/** Vecais viena lauka komentārs */
function storageKeyInternalLegacy(sessionId: string) {
  return `provin-admin-internal-v1-${sessionId}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3.5" fill="white" stroke="currentColor" strokeWidth="2" />
        ))}
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
  const portfolioBytes = useMemo(() => portfolio.reduce((a, p) => a + p.size, 0), [portfolio]);

  const mergedKmPoints = useMemo(() => mergeKmForChart(pdfInsights), [pdfInsights]);

  const previewAnalysis = useMemo(
    () =>
      analyzeVinAndKm({
        orderVin: payload.vin,
        blocks: [
          { label: "CSDD", text: ws.csdd },
          { label: "LTAB", text: ws.ltab },
          { label: "Tirgus un sludinājuma piezīmes", text: ws.tirgus },
          { label: "Citi avoti", text: ws.citi },
        ],
        fileNames: portfolio.map((p) => p.name),
      }),
    [payload.vin, ws.csdd, ws.ltab, ws.tirgus, ws.citi, portfolio],
  );

  const updateWs = useCallback((patch: Partial<WorkspacePersist>) => {
    setWs((prev) => ({ ...prev, ...patch }));
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
      const raw = localStorage.getItem(storageKeyWorkspace(payload.sessionId));
      if (raw) {
        const p = JSON.parse(raw) as Partial<WorkspacePersist>;
        setWs({
          ...EMPTY_WORKSPACE,
          ...p,
          previewConfirmed: Boolean(p.previewConfirmed),
        });
      } else {
        const legacy = localStorage.getItem(storageKeyInternalLegacy(payload.sessionId));
        const seed = payload.serverInternalComment?.trim()
          ? { ...EMPTY_WORKSPACE, citi: payload.serverInternalComment ?? "" }
          : EMPTY_WORKSPACE;
        if (legacy) {
          setWs({ ...seed, citi: legacy, previewConfirmed: false });
        } else {
          setWs(seed);
        }
      }
    } catch {
      setWs(EMPTY_WORKSPACE);
    }
    setWorkspaceHydrated(true);
  }, [payload.sessionId, payload.serverInternalComment]);

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
        for (const p of pdfs) {
          if (cancelled) return;
          const buf = await fetch(p.blobUrl).then((r) => r.arrayBuffer());
          const ins = await analyzePdfBuffer(p.name, buf);
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

  const openPrintReport = () => {
    if (!canGeneratePdf) {
      alert(
        "Vispirms: 1) aizpildi avotu laukus un pievieno failus, 2) atver Priekšskatu un apstiprini, 3) ieraksti IRISS komentāru. Tad ģenerē PDF.",
      );
      return;
    }

    const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long", timeStyle: "short" });
    const money =
      payload.amountTotal == null
        ? "—"
        : new Intl.NumberFormat("lv-LV", { style: "currency", currency: payload.currency ?? "EUR" }).format(
            payload.amountTotal / 100,
          );

    const printStyles = `
      *{box-sizing:border-box;}
      body{
        font-family:var(--font-inter,system-ui),-apple-system,"Segoe UI",Roboto,sans-serif;
        line-height:1.55;max-width:190mm;margin:0 auto;padding:12mm 14mm;color:#1d1d1f;
        background:#fafbfc;counter-reset:sec;
      }
      .sheet{background:#fff;border-radius:12px;box-shadow:0 1px 0 rgba(0,0,0,.06);padding:18mm 16mm;}
      @media print{.sheet{box-shadow:none;border-radius:0;padding:0}}
      .report-head{
        border-bottom:3px solid #0066d6;padding-bottom:14px;margin-bottom:18px;
        background:linear-gradient(180deg,#fafdff 0%,#fff 100%);
        margin-left:-4px;margin-right:-4px;padding-left:4px;padding-right:4px;padding-top:4px;border-radius:8px 8px 0 0;
      }
      .report-head .brand{font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#0066d6;font-weight:700;}
      .report-head .brand span{color:#1d1d1f;}
      .report-head h1{font-size:1.42rem;font-weight:650;margin:8px 0 6px;color:#1d1d1f;letter-spacing:-0.02em;}
      .report-head .sub{font-size:0.84rem;color:#6e6e73;}
      .expert-panel{
        margin:20px 0 22px;padding:16px 18px;border-radius:10px;
        background:linear-gradient(135deg,#e8f2fc 0%,#f5f9ff 50%,#fff 100%);
        border:1px solid rgba(0,102,214,.22);border-left:4px solid #0066d6;
        box-shadow:0 2px 12px rgba(0,102,214,.06);
      }
      .expert-panel .expert-title{
        font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#0066d6;font-weight:700;margin:0 0 10px;
      }
      .expert-panel .expert-body{
        font-size:0.92rem;color:#1d1d1f;white-space:pre-wrap;line-height:1.6;
      }
      h2.sec{
        font-size:0.98rem;font-weight:650;margin:1.25rem 0 0.6rem;color:#1d1d1f;padding-bottom:7px;
        border-bottom:1px solid #e5e5ea;counter-increment:sec;
      }
      h2.sec::before{content:counter(sec) ". ";color:#0066d6;font-weight:750;}
      h3.sub{font-size:0.89rem;font-weight:600;margin:1rem 0 0.45rem;color:#424245;}
      h4.sub2{font-size:0.86rem;font-weight:600;margin:0.85rem 0 0.35rem;color:#1d1d1f;}
      table{width:100%;border-collapse:collapse;font-size:0.82rem;}
      table.fmt{margin:0.45rem 0;}
      table.fmt td{padding:7px 10px;border:1px solid #e5e7eb;vertical-align:top;}
      table.fmt:not(.grid) td:first-child{width:38%;background:#f5f5f7;color:#424245;font-weight:550;}
      table.fmt.grid td{font-size:0.8rem;}
      table.fmt.grid td:first-child{width:auto;}
      table:not(.fmt) td{padding:8px 10px;border:1px solid #e5e7eb;vertical-align:top;}
      table:not(.fmt) td:first-child{width:36%;background:#f5f5f7;color:#424245;font-weight:550;}
      pre.block{white-space:pre-wrap;font-size:0.82rem;background:#f5f5f7;border:1px solid #e8e8ed;padding:11px 14px;border-radius:9px;margin:0;}
      .na{color:#86868b;font-style:italic;}
      ul{margin:0.4rem 0;padding-left:1.15rem;}
      li{margin:0.25rem 0;}
      .hint{font-size:0.76rem;color:#6e6e73;margin-top:0.45rem;line-height:1.45;}
      .legal-block{
        margin-top:26px;padding:14px 16px;border-radius:10px;background:#f5f5f7;border:1px solid #e8e8ed;
        font-size:0.74rem;color:#6e6e73;line-height:1.55;
      }
      .legal-block strong{color:#424245;font-weight:600;}
      .report-foot{margin-top:18px;padding-top:12px;border-top:1px solid #e5e5ea;font-size:0.7rem;color:#aeaeb2;line-height:1.45;}
      code{font-size:0.78rem;background:#f5f5f7;padding:1px 5px;border-radius:4px;}
      @media print{
        body{padding:10mm 12mm;background:#fff;}
        .sheet{background:#fff}
        .no-print{display:none!important;}
      }
    `;

    const lines: string[] = [];
    lines.push('<div class="sheet">');
    lines.push('<div class="report-head">');
    lines.push(
      '<div class="brand">PRO<span style="color:#0066d6">VIN</span><span>.LV</span></div>',
    );
    lines.push(`<h1>${escapeHtml(CLIENT_REPORT_SECTION_LABELS.mainTitle)}</h1>`);
    lines.push(
      `<p class="sub">Ģenerēts: ${escapeHtml(dateFmt.format(new Date()))} · VIN ${escapeHtml(payload.vin ?? "—")}</p>`,
    );
    lines.push("</div>");

    lines.push(
      `<div class="expert-panel"><p class="expert-title">${escapeHtml(REPORT_PDF_STANDARDS.firstPageExpertBlockTitle)}</p>`,
    );
    lines.push(`<div class="expert-body">${escapeHtml(ws.iriss.trim())}</div></div>`);

    lines.push(`<h2 class="sec">${escapeHtml(CLIENT_REPORT_SECTION_LABELS.identification)}</h2>`);
    lines.push(`<table>`);
    lines.push(`<tr><td>Atsauce (pasūtījums)</td><td><code>${escapeHtml(payload.sessionId)}</code></td></tr>`);
    lines.push(`<tr><td>Reģistrēts</td><td>${escapeHtml(dateFmt.format(new Date(payload.created * 1000)))}</td></tr>`);
    lines.push(`<tr><td>Maksājuma statuss</td><td>${escapeHtml(payload.paymentStatus)} · ${escapeHtml(money)}</td></tr>`);
    lines.push(`</table>`);

    lines.push(`<h2 class="sec">${escapeHtml(CLIENT_REPORT_SECTION_LABELS.attachments)}</h2>`);
    if (portfolio.length === 0) {
      lines.push('<p class="na">Nav pievienotu dokumentu.</p>');
    } else {
      lines.push("<ul>");
      for (const p of portfolio) {
        const disp = sanitizeAttachmentFileNameForReport(p.name);
        lines.push(`<li>${escapeHtml(disp)} (${formatBytes(p.size)})</li>`);
      }
      lines.push("</ul>");
    }

    if (pdfInsights.length > 0) {
      lines.push('<h3 class="sub">Teksta izvilkums no pievienotajiem PDF (automātiski)</h3>');
      lines.push(
        '<p class="hint">Īss automātisks apkopojums no dokumentu teksta slāņa — riska atslēgvārdi un nobraukuma skaitļi. Salīdzini ar pievienotajiem PDF; vizuālie grafiki šeit nav atveidoti.</p>',
      );
      for (const ins of pdfInsights) {
        const fn = sanitizeAttachmentFileNameForReport(ins.fileName);
        lines.push(`<h4 class="sub2">${escapeHtml(fn)}</h4>`);
        lines.push(
          `<p class="hint">${ins.charCount.toLocaleString("lv-LV")} rakstzīmes · ${ins.kmSamples.length} nobraukuma paraugi</p>`,
        );
        if (ins.highlights.length > 0) {
          lines.push("<ul>");
          for (const h of ins.highlights) {
            lines.push(`<li>${escapeHtml(h)}</li>`);
          }
          lines.push("</ul>");
        }
        if (ins.kmSamples.length > 0) {
          lines.push('<table class="fmt grid"><tbody>');
          lines.push("<tr><td>km</td><td>Konteksts</td></tr>");
          for (const s of ins.kmSamples.slice(0, 32)) {
            lines.push(
              `<tr><td>${s.km.toLocaleString("lv-LV")}</td><td>${escapeHtml(s.context ?? "—")}</td></tr>`,
            );
          }
          lines.push("</tbody></table>");
        }
      }
      const kmMerged = mergeKmForChart(pdfInsights);
      if (kmMerged.length >= 2) {
        lines.push('<h4 class="sub2">Apvienotie nobraukuma paraugi</h4>');
        lines.push('<table class="fmt grid"><tbody>');
        lines.push("<tr><td>km</td><td>Piezīme</td></tr>");
        for (const pt of kmMerged) {
          const lbl = sanitizeAttachmentFileNameForReport(pt.label);
          lines.push(`<tr><td>${pt.km.toLocaleString("lv-LV")}</td><td>${escapeHtml(lbl)}</td></tr>`);
        }
        lines.push("</tbody></table>");
      }
    }

    lines.push(`<h2 class="sec">${escapeHtml(CLIENT_REPORT_SECTION_LABELS.dataAppendix)}</h2>`);
    const blocks: {
      title: string;
      key: keyof Pick<WorkspacePersist, "csdd" | "ltab" | "tirgus" | "citi">;
      variant: SegmentOptions["variant"];
    }[] = [
      { title: CLIENT_REPORT_SECTION_LABELS.registryNotes, key: "csdd", variant: "default" },
      { title: CLIENT_REPORT_SECTION_LABELS.insuranceNotes, key: "ltab", variant: "default" },
      { title: CLIENT_REPORT_SECTION_LABELS.marketNotes, key: "tirgus", variant: "tirgus" },
      { title: CLIENT_REPORT_SECTION_LABELS.otherNotes, key: "citi", variant: "default" },
    ];
    for (const b of blocks) {
      lines.push(`<h3 class="sub">${escapeHtml(b.title)}</h3>`);
      lines.push(workspaceBlockToHtml(ws[b.key], b.variant));
    }

    lines.push(`<h2 class="sec">${escapeHtml(CLIENT_REPORT_SECTION_LABELS.supplementary)}</h2>`);
    lines.push(`<h3 class="sub">Sludinājuma saite</h3>`);
    lines.push(
      `<p>${payload.listingUrl ? escapeHtml(payload.listingUrl) : '<span class="na">—</span>'}</p>`,
    );
    lines.push(`<h3 class="sub">Ziņojums no klienta formas</h3>`);
    lines.push(`<pre class="block">${escapeHtml(payload.notes?.trim() ? payload.notes : "—")}</pre>`);

    lines.push(`<h2 class="sec">${escapeHtml(CLIENT_REPORT_SECTION_LABELS.contacts)}</h2>`);
    lines.push("<table>");
    lines.push(`<tr><td>Vārds</td><td>${escapeHtml(payload.customerName ?? "—")}</td></tr>`);
    lines.push(`<tr><td>E-pasts</td><td>${escapeHtml(payload.customerEmail ?? "—")}</td></tr>`);
    lines.push(`<tr><td>Tālrunis</td><td>${escapeHtml(payload.customerPhone ?? "—")}</td></tr>`);
    lines.push("</table>");

    if (payload.isDemo) {
      lines.push('<p class="hint"><strong>Demonstrācijas dati</strong> — daļa lauku ir parauga rakstura.</p>');
    }

    lines.push('<div class="legal-block">');
    lines.push(`<p><strong>Juridisks pārskats.</strong> ${escapeHtml(CLIENT_REPORT_SERVICE_NOTICE)}</p>`);
    lines.push(`<p style="margin-top:8px">${escapeHtml(CLIENT_REPORT_FOOTER_DISCLAIMER)}</p>`);
    lines.push("</div>");

    lines.push(
      '<p class="no-print" style="margin-top:1.5rem"><button type="button" style="padding:10px 22px;font-size:14px;border-radius:999px;border:0;background:#0066d6;color:#fff;cursor:pointer;font-weight:600" onclick="window.print()">Drukāt / saglabāt kā PDF</button></p>',
    );

    lines.push(
      `<div class="report-foot">© PROVIN.LV · konsultatīva atskaite · ${escapeHtml(dateFmt.format(new Date()))}</div>`,
    );
    lines.push("</div>");

    const html = `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><title>PROVIN ${escapeHtml(
      payload.vin ?? payload.sessionId,
    )}</title><style>${printStyles}</style></head><body>${lines.join("\n")}</body></html>`;

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
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[var(--color-apple-text)]">Priekšskats — apkopota informācija</h3>
        <p className="mt-1.5 text-sm leading-snug text-[var(--color-provin-muted)]">
          Secība: <strong className="text-[var(--color-apple-text)]">1)</strong> portfeļa faili,{" "}
          <strong className="text-[var(--color-apple-text)]">2)</strong> piezīmju bloki pēc avota (tabulas tiek saliktas
          automātiski no ielīmētā teksta). Sludinājumu „liekie” teikumi (piem., autorizācijas aicinājumi) tiek izfiltrēti.
          Tukši lauki PDF: „Informācija nav pieejama”.
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
              <p className="mt-2 text-xs text-[var(--color-provin-muted)]">PDF teksta izvilkšana…</p>
            ) : null}
            {pdfScanError ? <p className="mt-2 text-xs text-amber-800">{pdfScanError}</p> : null}
            {!pdfScanning && pdfInsights.length > 0 ? (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs">
                <p className="font-medium text-[var(--color-apple-text)]">
                  No PDF automātiski (teksts, nevis vizuālais avots)
                </p>
                <p className="text-[var(--color-provin-muted)]">
                  Atslēgvārdi (negadījumi, atsaukumi, u.c.) un nobraukuma skaitļi. Salīdzini ar oriģināļiem — tabulas
                  atšķiras.
                </p>
                {mergedKmPoints.length >= 2 ? <KmMergeChart points={mergedKmPoints} /> : null}
                {pdfInsights.map((ins, fi) => (
                  <div key={`${ins.fileName}-${fi}`} className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                    <p className="font-medium text-[var(--color-apple-text)]">{ins.fileName}</p>
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
          <li>
            <span className="font-medium">CSDD</span>
            <PreviewWorkspaceBody text={ws.csdd} variant="default" />
          </li>
          <li>
            <span className="font-medium">LTAB</span>
            <PreviewWorkspaceBody text={ws.ltab} variant="default" />
          </li>
          <li>
            <span className="font-medium">Tirgus un sludinājuma piezīmes</span>
            <PreviewWorkspaceBody text={ws.tirgus} variant="tirgus" />
          </li>
          <li>
            <span className="font-medium">Citi avoti</span>
            <PreviewWorkspaceBody text={ws.citi} variant="default" />
          </li>
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
    <div className="space-y-3">
      {previewOpen ? previewBody : null}

      <details className="group rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-3 shadow-sm open:shadow-md">
        <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--color-apple-text)] marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            Darba secība (portfelis → avoti → priekšskats → IRISS → PDF)
            <span className="text-xs font-normal text-[var(--color-provin-muted)] group-open:hidden">(atvērt)</span>
          </span>
        </summary>
        <div className="mt-2 space-y-1.5 border-t border-slate-200/80 pt-2 text-sm leading-snug text-[var(--color-provin-muted)]">
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>Pievieno vēstures atskaišu PDF un citus pielikumus.</li>
            <li>
              Aizpildi piezīmes laukos: CSDD, LTAB, Tirgus un sludinājuma piezīmes, Citi avoti (tukšs → PDF: „Informācija
              nav pieejama”).
            </li>
            <li>Spied <strong className="text-[var(--color-apple-text)]">Priekšskats</strong>, pārskati apkopojumu.</li>
            <li>Pēc apstiprinājuma raksti <strong className="text-[var(--color-apple-text)]">IRISS komentāru</strong>.</li>
            <li>Tad aktivizējas <strong className="text-[var(--color-apple-text)]">PDF ģenerēšana</strong> klienta audita atskaitei.</li>
          </ol>
          <p className="text-xs">Dati šajā solī tiek saglabāti pārlūkā (localStorage + IndexedDB), līdz būs servera datubāze.</p>
        </div>
      </details>

      <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">
            1. Papildu faili — klienta portfelis
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
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
          Starptautisko un vietējo vēstures formātu PDF. Glabāšana:{" "}
          <strong className="font-medium text-[var(--color-apple-text)]">IndexedDB</strong>. Katram failam —{" "}
          <strong className="font-medium text-[var(--color-apple-text)]">Saglabāt</strong> (ieraksta portfeli) un{" "}
          <strong className="font-medium text-[var(--color-apple-text)]">Labot</strong> (skats / pilnas darbības), kā pielikumu
          rindām.
        </p>
        <div className="mt-2.5">
          <input
            id={fileInputId}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <label
            htmlFor={fileInputId}
            className="inline-flex cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-apple-text)] shadow-sm hover:bg-slate-50"
          >
            Pievienot failus…
          </label>
          <span className="ml-3 text-xs text-[var(--color-provin-muted)]">
            līdz {formatBytes(MAX_FILE_BYTES)} / fails, kopā ~{formatBytes(MAX_TOTAL_BYTES)} (
            {formatBytes(Math.round(portfolioBytes))})
          </span>
        </div>
        {fileError ? <p className="mt-2 text-sm text-amber-800">{fileError}</p> : null}
        {portfolio.length > 0 ? (
          <ul className="mt-2.5 space-y-2">
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
          <p className="mt-2.5 text-sm text-[var(--color-provin-muted)]">Vēl nav pievienotu failu.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">
          2. Piezīmes pēc avota (manuāli)
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
          Katram blokam savs lauks. Ja atstāj tukšu, PDF ietver tekstu:{" "}
          <strong className="font-medium text-[var(--color-apple-text)]">Informācija nav pieejama</strong>. Sākumā, ja ir
          demo/servera teksts, tas var būt ielādēts „Citi avoti”.
        </p>
        <div className="mt-2.5 space-y-3">
          {(
            [
              { key: "csdd" as const, label: "CSDD" },
              { key: "ltab" as const, label: "LTAB" },
              { key: "tirgus" as const, label: "Tirgus un sludinājuma piezīmes" },
              { key: "citi" as const, label: "Citi avoti" },
            ] as const
          ).map(({ key, label }) => (
            <AdminSavableTextField
              key={key}
              id={`${fileInputId}-${key}`}
              label={label}
              value={ws[key]}
              onChange={(v) => updateWs({ [key]: v })}
              placeholder={`Ievadi piezīmes: ${label}…`}
              multiline
              minHeightClass="min-h-[64px]"
              resetVersion={workspaceFieldResetKey}
            />
          ))}
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex rounded-full border border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--color-provin-accent)] hover:bg-[#d4e8fb]"
          >
            Priekšskats — apkopotā secība
          </button>
          {ws.previewConfirmed ? (
            <p className="mt-2 text-xs font-medium text-emerald-800">Priekšskats apstiprināts — vari rakstīt IRISS komentāru.</p>
          ) : (
            <p className="mt-2 text-xs text-[var(--color-provin-muted)]">Pēc pārskatīšanas apstiprini modālī.</p>
          )}
        </div>
      </section>

      <section
        className={`rounded-xl border p-3.5 shadow-sm ${
          ws.previewConfirmed
            ? "border-slate-200/80 bg-white"
            : "border-dashed border-slate-200 bg-slate-50/50"
        }`}
      >
        <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">3. IRISS komentārs</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">
          Galvenais eksperta slēdziens klienta PDF — pēc priekšskata apstiprinājuma.
        </p>
        <div className="mt-2">
          <AdminSavableTextField
            id={`${fileInputId}-iriss`}
            label="IRISS teksts"
            value={ws.iriss}
            onChange={(v) => updateWs({ iriss: v })}
            placeholder="Piem., ko saki IRISS / klientam pēc visa apkopojuma…"
            multiline
            disabled={!ws.previewConfirmed}
            resetVersion={workspaceFieldResetKey}
          />
        </div>
        {!ws.previewConfirmed ? (
          <p className="mt-2 text-xs text-amber-800">Vispirms apstiprini priekšskatu.</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-[var(--color-provin-accent)]/30 bg-[var(--color-provin-accent-soft)]/50 p-3.5">
        <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">4. Ģenerēt PDF — klienta atskaite</h2>
        <p className="mt-1 text-sm leading-snug text-[var(--color-provin-muted)]">
          Pieejams tikai pēc apstiprināta priekšskata un aizpildīta IRISS lauka. Atver druku un saglabā kā PDF.
        </p>
        <button
          type="button"
          onClick={openPrintReport}
          disabled={!canGeneratePdf}
          className="mt-3 inline-flex rounded-full bg-[var(--color-provin-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Ģenerēt PDF (druka)
        </button>
        {!canGeneratePdf ? (
          <p className="mt-2 text-xs text-[var(--color-provin-muted)]">
            Nepieciešams: apstiprināts priekšskats + IRISS komentārs.
          </p>
        ) : null}
      </section>
    </div>
  );
}

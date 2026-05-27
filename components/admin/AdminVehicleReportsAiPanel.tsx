"use client";

import { FileUp, Loader2, Sparkles } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { VehicleAIExtraction, VehicleAiExtractionMeta } from "@/lib/vehicle-ai-extraction-types";
import { formatAdminGeminiFetchError } from "@/lib/admin-gemini-client-errors";

const SEVERITY_STYLES = {
  CRITICAL: "border-l-[#FF4D4D] bg-[#FF4D4D]/[0.06] text-[#1d1d1f]",
  WARNING: "border-l-[#FFC107] bg-[#FFC107]/[0.08] text-[#1d1d1f]",
  INFO: "border-l-[#007AFF] bg-[#007AFF]/[0.06] text-[#1d1d1f]",
} as const;

type Props = {
  sessionId: string;
  geminiAllowed: boolean;
  extraction: VehicleAIExtraction | null;
  extractionMeta: VehicleAiExtractionMeta | null;
  commentsDraft: string;
  onCommentsDraftChange: (value: string) => void;
  onExtractionChange: (extraction: VehicleAIExtraction, meta: VehicleAiExtractionMeta) => void;
  /** Papildus PDF no portfeļa (tikai .pdf). */
  collectPortfolioPdfFiles?: () => Promise<File[]>;
  onApplyExtraction: (extraction: VehicleAIExtraction) => { filledFields: string[] };
  /** Obligāti await pēc importa — servera persist + verify. */
  onImportComplete?: () => Promise<boolean>;
  compact?: boolean;
};

export function AdminVehicleReportsAiPanel({
  sessionId,
  geminiAllowed,
  extraction,
  extractionMeta,
  commentsDraft,
  onCommentsDraftChange,
  onExtractionChange,
  collectPortfolioPdfFiles,
  onApplyExtraction,
  onImportComplete,
  compact,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list?.length) return;
    const pdfs: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!f) continue;
      if (!/\.pdf$/i.test(f.name) && f.type && !f.type.includes("pdf")) continue;
      pdfs.push(f);
    }
    if (pdfs.length === 0) {
      setError("Tikai PDF faili");
      return;
    }
    setPending((prev) => {
      const names = new Set(prev.map((p) => p.name));
      const next = [...prev];
      for (const f of pdfs) {
        if (!names.has(f.name)) next.push(f);
      }
      return next.slice(0, 8);
    });
    setError(null);
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!geminiAllowed) {
      setError("Gemini nav pieejams šim pasūtījumam");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setStatusLine("Augšupielādē PDF un nolasām teksta slāni…");
    try {
      const portfolioFiles = collectPortfolioPdfFiles ? await collectPortfolioPdfFiles() : [];
      const all = [...pending, ...portfolioFiles.filter((p) => !pending.some((x) => x.name === p.name))].slice(0, 8);
      if (all.length === 0) {
        setError("Pievieno vismaz vienu PDF (augšupielāde vai portfelī)");
        return;
      }
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      for (const f of all) fd.append("files", f);
      setStatusLine(
        all.length > 1
          ? `Nolasām ${all.length} PDF — ja teksta slānis tukšs, turpinām ar Gemini (inline PDF)…`
          : "Nolasām PDF — ja teksta slānis tukšs, turpinām ar Gemini…",
      );
      const res = await fetch("/api/admin/reports/ai-extract", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      setStatusLine("Gemini analīze (var ilgt līdz 1–2 min)…");
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        extraction?: VehicleAIExtraction;
        meta?: VehicleAiExtractionMeta & { charCounts?: number[]; usedGeminiInlinePdf?: string[] };
        warnings?: string[];
      };
      if (!res.ok) {
        const detail = typeof data.detail === "string" ? data.detail.trim() : "";
        if (data.error === "pdf_extract_empty" || data.error === "no_pdf_input") {
          setError(detail || formatAdminGeminiFetchError(data, res, "Neizdevās sagatavot PDF analīzei"));
        } else {
          setError(formatAdminGeminiFetchError(data, res, "Neizdevās analizēt PDF"));
        }
        return;
      }
      if (!data.extraction || !data.meta) {
        setError("Trūkst analīzes rezultāta");
        return;
      }
      const meta: VehicleAiExtractionMeta = {
        analyzedAt: data.meta.analyzedAt ?? new Date().toISOString(),
        fileNames: data.meta.fileNames ?? all.map((f) => f.name),
        sources: data.meta.sources ?? [],
      };
      onExtractionChange(data.extraction, meta);
      const applied = onApplyExtraction(data.extraction);
      if (data.extraction.ai_generated_comments_lv.trim()) {
        const cur = commentsDraft.trim();
        const next = data.extraction.ai_generated_comments_lv.trim();
        onCommentsDraftChange(cur ? `${cur}\n\n${next}` : next);
      }
      let persistOk = true;
      if (onImportComplete) {
        persistOk = await onImportComplete();
      }
      if (!persistOk) {
        setError("Analīze pabeigta, bet servera saglabāšana neizdevās — pārbaudi Vercel Blob env.");
        return;
      }
      const inline = data.meta?.usedGeminiInlinePdf?.length
        ? ` Gemini lasīja ${data.meta.usedGeminiInlinePdf.length} PDF tieši.`
        : "";
      const warn =
        data.warnings?.length ?
          ` Brīdinājumi: ${data.warnings.slice(0, 2).join("; ")}${data.warnings.length > 2 ? "…" : ""}`
        : "";
      setNotice(
        `Analīze pabeigta — ${all.length} PDF. Aizpildīti: ${applied.filledFields.length ? applied.filledFields.join(", ") : "nav jaunu lauku"}.${inline}${warn}`,
      );
      setPending([]);
    } catch {
      setError("Neizdevās savienoties ar serveri");
    } finally {
      setBusy(false);
      setStatusLine(null);
    }
  }, [
    collectPortfolioPdfFiles,
    commentsDraft,
    geminiAllowed,
    onApplyExtraction,
    onCommentsDraftChange,
    onExtractionChange,
    onImportComplete,
    pending,
    sessionId,
  ]);

  return (
    <div
      className={`mt-3 rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50/95 to-white p-2.5 shadow-sm ring-1 ring-slate-100/80 ${compact ? "" : ""}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-provin-muted)]">
          Sistēmas anomālijas un AI analīze
        </h3>
        {extractionMeta ? (
          <span className="text-[9px] text-[var(--color-provin-muted)]">
            {new Intl.DateTimeFormat("lv-LV", { dateStyle: "short", timeStyle: "short" }).format(
              new Date(extractionMeta.analyzedAt),
            )}
          </span>
        ) : null}
      </div>

      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        onClick={() => !busy && fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setDropActive(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDropActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDropActive(false);
          addFiles(e.dataTransfer.files);
        }}
        className={[
          "mb-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-2 py-3 text-center transition",
          dropActive
            ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)]/5"
            : "border-slate-300/90 bg-white/80 hover:border-slate-400",
          busy ? "pointer-events-none opacity-50" : "",
        ].join(" ")}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-provin-accent)]" aria-hidden />
        ) : (
          <FileUp className="h-4 w-4 text-[var(--color-provin-accent)]" aria-hidden />
        )}
        <span className="text-[10px] font-medium">Vairāki PDF (AutoDNA, CarVertical, LTAB, Vehicle Information…)</span>
        <span className="text-[9px] text-[var(--color-provin-muted)]">
          Velc šeit vai izvēlies · līdz 8 failiem · ~48 MB kopā
        </span>
      </div>

      {pending.length > 0 ? (
        <ul className="mb-2 space-y-0.5 text-[10px] text-[var(--color-apple-text)]">
          {pending.map((f) => (
            <li key={f.name} className="flex items-center justify-between gap-2">
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                className="shrink-0 text-slate-400 hover:text-red-600"
                onClick={() => setPending((p) => p.filter((x) => x.name !== f.name))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy || !geminiAllowed}
          onClick={() => void runAnalysis()}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--color-provin-accent)] px-2.5 py-1.5 text-[10px] font-semibold text-white hover:opacity-95 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Analizē…" : "Analizēt ar Gemini"}
        </button>
        {collectPortfolioPdfFiles ? (
          <button
            type="button"
            disabled={busy || !geminiAllowed}
            onClick={() => {
              void (async () => {
                const files = await collectPortfolioPdfFiles();
                if (files.length === 0) {
                  setError("Portfelī nav PDF failu");
                  return;
                }
                const dt = new DataTransfer();
                for (const f of files) dt.items.add(f);
                addFiles(dt.files);
                setNotice(`Pievienoti ${files.length} PDF no portfeļa — spied „Analizēt ar Gemini”.`);
              })();
            }}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50 disabled:opacity-50"
            title="Pievieno portfeļa PDF analīzes rindai"
          >
            + portfeļa PDF
          </button>
        ) : null}
      </div>

      {statusLine && busy ? (
        <p className="mt-1.5 text-[9px] leading-snug text-[var(--color-provin-accent)]" role="status">
          {statusLine}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-1.5 text-[9px] leading-snug text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-[9px] leading-snug text-amber-800" role="alert">
          {error}
        </p>
      ) : null}

      {extraction && extraction.anomalies.length > 0 ? (
        <div className="mt-3 space-y-1.5" role="list" aria-label="Anomālijas">
          {extraction.anomalies.map((a, i) => (
            <div
              key={`${a.category}-${i}`}
              role="listitem"
              className={`rounded-lg border-l-2 px-2.5 py-1.5 text-[10px] leading-snug ${SEVERITY_STYLES[a.severity]}`}
            >
              <p className="font-semibold uppercase tracking-wide text-[9px] opacity-80">
                {a.severity} · {a.category}
              </p>
              <p className="mt-0.5 font-normal">{a.description_lv}</p>
            </div>
          ))}
        </div>
      ) : extraction ? (
        <p className="mt-2 text-[10px] text-[var(--color-provin-muted)]">Kritiskas anomālijas netika konstatētas.</p>
      ) : null}

      {extraction ? (
        <div className="mt-3">
          <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
            AI komentāri (rediģējams — sinhronizēts ar „Komentārs”)
          </label>
          <textarea
            className="w-full min-h-[72px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
            value={commentsDraft}
            onChange={(e) => onCommentsDraftChange(e.target.value)}
            placeholder="Gemini kopsavilkums latviski…"
          />
        </div>
      ) : null}
    </div>
  );
}

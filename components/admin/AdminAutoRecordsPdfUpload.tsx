/** Pagaidām nav montēts admin UI — PDF augšupielāde atslēgta līdz jaunai implementācijai. */
"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { AutoRecordsPdfParseResult } from "@/lib/auto-records-pdf-parse";

type Props = {
  disabled?: boolean;
  readOnly?: boolean;
  onImported: (result: AutoRecordsPdfParseResult & { fileName?: string }) => void;
  onParseActiveChange?: (active: boolean) => void;
};

export function AdminAutoRecordsPdfUpload({ disabled, readOnly, onImported, onParseActiveChange }: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (disabled || readOnly || busy) return;
      setBusy(true);
      onParseActiveChange?.(true);
      setError(null);
      setNotice(null);
      setStatusLine("Nolasām PDF teksta slāni…");
      try {
        const fd = new FormData();
        fd.set("file", file);
        setStatusLine("Apstrādājam PDF (ja vajag — Gemini, līdz ~1 min)…");
        const res = await fetch("/api/admin/reports/parse-pdf", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as AutoRecordsPdfParseResult & {
          ok?: boolean;
          error?: string;
          detail?: string;
          fileName?: string;
        };
        if (!res.ok) {
          const detail = typeof data.detail === "string" ? data.detail.trim() : "";
          if (data.error === "unauthorized") {
            setError("Nav admin piekļuves");
          } else if (data.error === "missing_gemini_key") {
            setError("Nav GEMINI_API_KEY serverī");
          } else if (data.error === "file_too_large" || data.error === "payload_too_large") {
            setError(detail || "PDF fails pārāk liels");
          } else if (data.error === "invalid_file_type") {
            setError(detail || "Tikai PDF");
          } else {
            setError(detail || "Neizdevās apstrādāt PDF");
          }
          return;
        }
        const viaGemini =
          data.meta?.engine === "gemini_fallback" || data.meta?.extractionMethod === "gemini";
        const rowN = data.meta?.rowCount ?? data.serviceHistory?.length ?? 0;
        if (rowN > 0) {
          setNotice(
            `Importētas ${rowN} nobraukuma rinda(s) no „${file.name}”${viaGemini ? " (Plan B: Gemini)" : " (Plan A: lokāli)"}.`,
          );
        } else if ((data.rawUnprocessedData ?? "").trim()) {
          setNotice(`Plan B — RAW teksts no „${file.name}”; pārbaudi tabulu.`);
        } else if (data.warnings?.[0]) {
          setNotice(data.warnings[0]);
        }
        onParseActiveChange?.(false);
        onImported({
          serviceHistory: data.serviceHistory ?? [],
          rawUnprocessedData: data.rawUnprocessedData ?? "",
          suggestedPdfChecklist: data.suggestedPdfChecklist ?? {},
          suggestedOutvinVehicleInfo: data.suggestedOutvinVehicleInfo,
          suggestedComments: data.suggestedComments,
          warnings: data.warnings ?? [],
          meta: data.meta ?? { charCount: 0, rowCount: 0, usedOdometerSection: false },
          fileName: data.fileName ?? file.name,
        });
      } catch {
        setError("Neizdevās savienoties ar serveri");
      } finally {
        setBusy(false);
        onParseActiveChange?.(false);
        setStatusLine(null);
      }
    },
    [busy, disabled, onImported, onParseActiveChange, readOnly],
  );

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      void uploadFile(file);
    },
    [uploadFile],
  );

  const pick = () => {
    if (disabled || readOnly || busy) return;
    fileRef.current?.click();
  };

  if (readOnly) return null;

  return (
    <div className="mb-3">
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={disabled || busy ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick();
          }
        }}
        onClick={pick}
        onDragEnter={(e) => {
          e.preventDefault();
          if (disabled || busy) return;
          dragDepth.current += 1;
          setDropActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDropActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDropActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDropActive(false);
          if (disabled || busy) return;
          onFiles(e.dataTransfer.files);
        }}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-4 text-center transition",
          dropActive
            ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)]/5"
            : "border-slate-300/90 bg-slate-50/80 hover:border-slate-400 hover:bg-slate-50",
          disabled || busy ? "pointer-events-none opacity-50" : "",
        ].join(" ")}
        aria-busy={busy}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-provin-accent)]" aria-hidden />
        ) : (
          <FileUp className="h-5 w-5 text-[var(--color-provin-accent)]" aria-hidden />
        )}
        <span className="text-[11px] font-medium text-[var(--color-apple-text)]">
          Augšupielādēt auto-records.com PDF atskaiti
        </span>
        <span className="text-[9px] leading-snug text-[var(--color-provin-muted)]">
          Velc PDF šeit vai klikšķini · maks. 15 MB · skenētiem PDF — Gemini
        </span>
      </div>
      {statusLine && busy ? (
        <p className="mt-1 text-[9px] leading-snug text-[var(--color-provin-accent)]" role="status">
          {statusLine}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-1 text-[9px] leading-snug text-emerald-800/90" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[9px] leading-snug text-amber-800/90" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

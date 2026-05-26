"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { HistoryVendorPdfParseResult, HistoryVendorPdfTarget } from "@/lib/history-vendor-pdf-import";

const LABELS: Record<
  HistoryVendorPdfTarget,
  { title: string; hint: string }
> = {
  autodna: {
    title: "Augšupielādēt AutoDNA PDF atskaiti",
    hint: "Velc PDF šeit vai klikšķini · maks. 15 MB",
  },
  carvertical: {
    title: "Augšupielādēt CarVertical PDF atskaiti",
    hint: "Velc PDF šeit vai klikšķini · maks. 15 MB",
  },
  ltab: {
    title: "Augšupielādēt LTAB / OCTA PDF atskaiti",
    hint: "Velc PDF šeit vai klikšķini · maks. 15 MB",
  },
};

type Props = {
  target: HistoryVendorPdfTarget;
  disabled?: boolean;
  readOnly?: boolean;
  onImported: (result: HistoryVendorPdfParseResult & { fileName?: string }) => void;
};

export function AdminHistoryVendorPdfUpload({ target, disabled, readOnly, onImported }: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const labels = LABELS[target];

  const uploadFile = useCallback(
    async (file: File) => {
      if (disabled || readOnly || busy) return;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("target", target);
        const res = await fetch("/api/admin/reports/parse-pdf", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as HistoryVendorPdfParseResult & {
          ok?: boolean;
          error?: string;
          detail?: string;
          fileName?: string;
          geminiFallback?: boolean;
        };
        if (!res.ok) {
          const detail = typeof data.detail === "string" ? data.detail.trim() : "";
          if (data.error === "unauthorized") setError("Nav admin piekļuves");
          else if (data.error === "file_too_large" || data.error === "payload_too_large") {
            setError(detail || "PDF fails pārāk liels");
          } else if (data.error === "invalid_file_type") setError(detail || "Tikai PDF");
          else if (
            data.error === "pdf_extract_empty" ||
            data.error === "pdf_extract_failed" ||
            data.geminiFallback
          ) {
            setNotice(
              detail ||
                "Teksta slānis nav pieejams. Zemāk portfelī izmanto „Sistēmas anomālijas un AI analīze” — PDF tiks nosūtīts Gemini.",
            );
            setError(null);
          } else setError(detail || "Neizdevās apstrādāt PDF");
          return;
        }
        const parts: string[] = [];
        if (data.meta?.mileageRowCount) parts.push(`${data.meta.mileageRowCount} nobraukuma`);
        if (data.meta?.incidentRowCount) parts.push(`${data.meta.incidentRowCount} negadījumu`);
        if (parts.length > 0) {
          setNotice(`Importēts no „${file.name}”: ${parts.join(", ")} rinda(s).`);
        } else {
          setNotice(`Teksts importēts no „${file.name}” — pārbaudi RAW / tabulu.`);
        }
        if (data.warnings?.length) {
          setNotice((prev) => (prev ? `${prev} ${data.warnings![0]}` : (data.warnings![0] ?? null)));
        }
        onImported({
          rawText: data.rawText ?? "",
          serviceHistory: data.serviceHistory ?? [],
          incidents: data.incidents ?? [],
          suggestedPdfChecklist: data.suggestedPdfChecklist ?? {},
          warnings: data.warnings ?? [],
          meta: data.meta ?? { charCount: 0, mileageRowCount: 0, incidentRowCount: 0 },
          fileName: data.fileName ?? file.name,
        });
      } catch {
        setError("Neizdevās savienoties ar serveri");
      } finally {
        setBusy(false);
      }
    },
    [busy, disabled, onImported, readOnly, target],
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
        <span className="text-[11px] font-medium text-[var(--color-apple-text)]">{labels.title}</span>
        <span className="text-[9px] leading-snug text-[var(--color-provin-muted)]">{labels.hint}</span>
      </div>
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

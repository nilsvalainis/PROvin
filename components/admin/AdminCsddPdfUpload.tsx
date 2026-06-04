"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { CsddFormFields } from "@/lib/admin-source-blocks";

type CsddPdfImportPayload = {
  rawUnprocessedData: string;
  fields: CsddFormFields;
  warnings?: string[];
  fileName?: string;
};

type Props = {
  disabled?: boolean;
  readOnly?: boolean;
  onImported: (payload: CsddPdfImportPayload) => void;
  onParseActiveChange?: (active: boolean) => void;
};

export function AdminCsddPdfUpload({
  disabled,
  readOnly,
  onImported,
  onParseActiveChange,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (disabled || readOnly || busy) return;
      setBusy(true);
      onParseActiveChange?.(true);
      setError(null);
      setNotice(null);
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("target", "csdd");
        const res = await fetch("/api/admin/reports/parse-pdf", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as CsddPdfImportPayload & {
          ok?: boolean;
          error?: string;
          detail?: string;
        };
        if (!res.ok) {
          const detail = typeof data.detail === "string" ? data.detail.trim() : "";
          setError(detail || "Neizdevās apstrādāt CSDD PDF");
          return;
        }
        if (!data.fields) {
          setError("Nav strukturētu CSDD datu — izmanto raw lauku.");
          return;
        }
        setNotice(`CSDD PDF „${file.name}” importēts (Gemini Pro).`);
        onImported({
          rawUnprocessedData: data.rawUnprocessedData ?? "",
          fields: data.fields,
          warnings: data.warnings,
          fileName: file.name,
        });
      } catch {
        setError("Neizdevās savienoties ar serveri");
      } finally {
        setBusy(false);
        onParseActiveChange?.(false);
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

  if (readOnly) return null;

  return (
    <div className="mb-2">
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
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
        onClick={() => fileRef.current?.click()}
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
          onFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-3 text-center transition ${
          dropActive
            ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/60"
            : "border-slate-300/90 bg-slate-50/80 hover:border-[var(--color-provin-accent)]/40"
        } ${disabled || busy ? "pointer-events-none opacity-50" : ""}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-provin-accent)]" aria-hidden />
        ) : (
          <FileUp className="h-4 w-4 text-[var(--color-provin-accent)]" strokeWidth={2} aria-hidden />
        )}
        <span className="text-[10px] font-semibold text-[var(--color-provin-accent)]">
          Augšupielādēt CSDD PDF atskaiti
        </span>
        <span className="text-[9px] text-slate-500">
          Velc PDF vai klikšķini · Gemini Pro · papildus raw iekopēšanai
        </span>
      </div>
      {notice ? (
        <p className="mt-1 text-[9px] text-emerald-800/90" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[9px] text-amber-800/90" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

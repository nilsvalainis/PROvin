/**
 * Avota bloka PDF augšupielāde (AutoDNA / CarVertical) — Copilot aģents aizpilda tabulas.
 *
 * Aizpilda TIKAI strukturētās rindas (datums, odometrs, valsts, negadījumi EUR) un
 * OFICIĀLĀ DĪLERA DATI specifikācijas laukus. RAW / AI konteksta laukus neaiztiek.
 */
"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

export type VendorPdfUploadTarget = "autodna" | "carvertical" | "auto_records";

const LABELS: Record<VendorPdfUploadTarget, { title: string; hint: string }> = {
  autodna: {
    title: "Augšupielādēt AutoDNA PDF atskaiti",
    hint: "Velc PDF šeit vai klikšķini · Copilot aģents aizpilda tabulas (RAW lauki netiek aiztikti)",
  },
  carvertical: {
    title: "Augšupielādēt CarVertical PDF atskaiti",
    hint: "Velc PDF šeit vai klikšķini · Copilot aģents aizpilda tabulas (RAW lauki netiek aiztikti)",
  },
  auto_records: {
    title: "Augšupielādēt oficiālā dīlera PDF (BMW / auto-records.com)",
    hint: "Velc PDF šeit vai klikšķini · Copilot aizpilda transporta informāciju, servisa un nobraukuma tabulas",
  },
};

type Props = {
  target: VendorPdfUploadTarget;
  sessionId: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** Visi avotu bloki (aģentam vajag jau aizpildītos avotus valstu noteikšanai). */
  getSourceBlocks: () => WorkspaceSourceBlocks;
  applyPatchedBlocks: (
    patched: Partial<WorkspaceSourceBlocks>,
    changedKeys: CopilotSourceKey[],
  ) => void;
  /** `true` kamēr aģents strādā — bloķē autosaglabāšanu. */
  onParseActiveChange?: (active: boolean) => void;
};

type AgentResponse = {
  ok?: boolean;
  error?: string;
  detail?: string;
  summary?: string;
  notes?: string[];
  applied?: string[];
  skipped?: { label: string; reason: string }[];
  patchedSourceBlocks?: Partial<WorkspaceSourceBlocks>;
  changedKeys?: CopilotSourceKey[];
};

export function AdminHistoryVendorPdfUpload({
  target,
  sessionId,
  disabled,
  readOnly,
  getSourceBlocks,
  applyPatchedBlocks,
  onParseActiveChange,
}: Props) {
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
      onParseActiveChange?.(true);
      setError(null);
      setNotice(null);
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("target", target);
        fd.set("sessionId", sessionId);
        fd.set("sourceBlocks", JSON.stringify(getSourceBlocks()));

        const res = await fetch("/api/admin/copilot/vendor-pdf", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as AgentResponse;
        if (!res.ok || !data.ok) {
          const detail = (data.detail ?? "").trim();
          if (data.error === "unauthorized") setError("Nav admin piekļuves");
          else if (data.error === "missing_gemini_key") setError("Nav GEMINI_API_KEY serverī");
          else if (data.error === "file_too_large") setError(detail || "PDF fails pārāk liels");
          else if (data.error === "invalid_file_type") setError(detail || "Tikai PDF");
          else setError(detail || "Neizdevās apstrādāt PDF");
          return;
        }

        const changedKeys = data.changedKeys ?? [];
        if (data.patchedSourceBlocks && changedKeys.length > 0) {
          applyPatchedBlocks(data.patchedSourceBlocks, changedKeys);
        }
        const dropped = (data.skipped ?? []).filter(
          (s) => !s.reason.endsWith("already_filled") && s.reason !== "needs_confirm",
        );
        const lines = [
          data.summary?.trim() || `„${file.name}” apstrādāts.`,
          changedKeys.length > 0
            ? `Aizpildīts: ${changedKeys.join(", ")} (${data.applied?.length ?? 0} ieraksti).`
            : "Jaunu rindu nebija — tabulas jau atbilst atskaitei.",
          dropped.length > 0
            ? `Neievietoti ${dropped.length}: ${dropped
                .slice(0, 3)
                .map((s) => `${s.label} (${s.reason})`)
                .join("; ")}.`
            : "",
          ...(data.notes ?? []).slice(0, 4),
        ];
        setNotice(lines.filter(Boolean).join(" "));
      } catch {
        setError("Neizdevās savienoties ar serveri");
      } finally {
        setBusy(false);
        onParseActiveChange?.(false);
      }
    },
    [
      applyPatchedBlocks,
      busy,
      disabled,
      getSourceBlocks,
      onParseActiveChange,
      readOnly,
      sessionId,
      target,
    ],
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
      {busy ? (
        <p className="mt-1 text-[9px] leading-snug text-[var(--color-provin-accent)]" role="status">
          Copilot lasa PDF (teksta slānis + Gemini Pro, līdz ~1 min)…
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

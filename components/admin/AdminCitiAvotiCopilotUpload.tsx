"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { emitAdminAiUsage, isAiUsageSummary } from "@/lib/ai-usage";
import {
  SourcePdfBlobUploadError,
  sourcePdfNeedsBlobUpload,
  uploadSourcePdfToBlob,
} from "@/lib/admin-source-pdf-blob-client";

type Props = {
  sessionId: string;
  sectionIndex: number;
  sectionLabel: string;
  disabled?: boolean;
  readOnly?: boolean;
  getSourceBlocks: () => WorkspaceSourceBlocks;
  applyPatchedBlocks: (
    patched: Partial<WorkspaceSourceBlocks>,
    changedKeys: CopilotSourceKey[],
  ) => void;
};

export function AdminCitiAvotiCopilotUpload({
  sessionId,
  sectionIndex,
  sectionLabel,
  disabled,
  readOnly,
  getSourceBlocks,
  applyPatchedBlocks,
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
      setError(null);
      setNotice(null);
      try {
        const fd = new FormData();
        fd.set("sessionId", sessionId);
        fd.set(
          "message",
          `Izvelc datus no PDF un aizpildi CITI AVOTI sadaļu „${sectionLabel}”. Avots vienmēr citi_avoti, ne AutoDNA / CarVertical / CC.VIN.`,
        );
        fd.set("applyMode", "auto");
        fd.set("sourceBlocks", JSON.stringify(getSourceBlocks()));
        fd.set("allowedSources", JSON.stringify(["citi_avoti"]));
        fd.set("citiAvotiSectionIndex", String(sectionIndex));
        if (sourcePdfNeedsBlobUpload(file)) {
          setNotice(`„${file.name}” (${Math.round(file.size / (1024 * 1024))} MB) — augšupielāde krātuvē…`);
          const ref = await uploadSourcePdfToBlob(sessionId, file);
          fd.set("fileUrls", JSON.stringify([ref]));
          setNotice(null);
        } else {
          fd.append("files", file);
        }

        const res = await fetch("/api/admin/copilot", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          detail?: string;
          reply?: string;
          usage?: unknown;
          changedKeys?: CopilotSourceKey[];
          patchedSourceBlocks?: Partial<WorkspaceSourceBlocks>;
          autoApplied?: { label?: string }[];
        };
        if (isAiUsageSummary(data.usage)) emitAdminAiUsage(data.usage);
        if (!res.ok) {
          setError(data.detail || data.error || `Copilot kļūda (HTTP ${res.status})`);
          return;
        }
        const changedKeys = data.changedKeys ?? [];
        if (data.patchedSourceBlocks && changedKeys.length > 0) {
          applyPatchedBlocks(data.patchedSourceBlocks, changedKeys);
        }
        setNotice(
          data.reply?.trim() ||
            (changedKeys.length > 0
              ? `Copilot aizpildīja „${sectionLabel}” (${data.autoApplied?.length ?? 0} ieraksti).`
              : `„${file.name}” apstrādāts. Jaunu rindu nebija.`),
        );
      } catch (e) {
        setError(
          e instanceof SourcePdfBlobUploadError ? e.message : "Neizdevās savienoties ar serveri",
        );
      } finally {
        setBusy(false);
      }
    },
    [applyPatchedBlocks, busy, disabled, getSourceBlocks, readOnly, sectionIndex, sectionLabel, sessionId],
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
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadFile(file);
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
          const file = e.dataTransfer.files?.[0];
          if (file) void uploadFile(file);
        }}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-4 text-center transition",
          dropActive
            ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)]/5"
            : "border-slate-300/90 bg-slate-50/80 hover:border-slate-400 hover:bg-slate-50",
          disabled || busy ? "pointer-events-none opacity-50" : "",
        ].join(" ")}
        aria-busy={busy}
        aria-label={`Copilot PDF „${sectionLabel}”`}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-provin-accent)]" aria-hidden />
        ) : (
          <FileUp className="h-5 w-5 text-[var(--color-provin-accent)]" aria-hidden />
        )}
        <span className="text-[11px] font-medium text-[var(--color-apple-text)]">
          Copilot · {sectionLabel}
        </span>
        <span className="text-[9px] leading-snug text-[var(--color-provin-muted)]">
          Velc PDF šeit vai klikšķini. Aizpilda šī avota tabulas un RAW.
        </span>
      </div>
      {busy ? (
        <p className="mt-1 text-[9px] leading-snug text-[var(--color-provin-accent)]" role="status">
          Copilot lasa PDF…
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

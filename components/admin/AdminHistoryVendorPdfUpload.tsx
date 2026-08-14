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
import {
  SourcePdfBlobUploadError,
  sourcePdfNeedsBlobUpload,
  uploadSourcePdfToBlob,
} from "@/lib/admin-source-pdf-blob-client";

export type VendorPdfUploadTarget = "autodna" | "carvertical" | "auto_records" | "cc_vin" | "ltab";

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
  cc_vin: {
    title: "Augšupielādēt starptautiskās vēstures PDF atskaiti",
    hint: "Velc PDF šeit vai klikšķini · nolasām sarkanos karogus, odometru, bojājumus un īpašumtiesību ierakstus",
  },
  ltab: {
    title: "Augšupielādēt LTAB izziņu (PDF)",
    hint: "Velc PDF šeit vai klikšķini · nolasām CSNg datumu, summu, statusu un izziņas galveni",
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

const ERROR_LABELS: Record<string, string> = {
  unauthorized: "Nav admin piekļuves",
  missing_ai_key: "Serverī nav ANTHROPIC_API_KEY",
  ai_demo_only: "AI atļauts tikai DEMO pasūtījumiem (AI_DEMO_ONLY)",
  not_found: "Pasūtījums nav atrasts Stripe",
  missing_session_id: "Trūkst pasūtījuma sessionId",
  missing_session: "Trūkst pasūtījuma sessionId",
  missing_source_blocks: "Avotu bloki netika nosūtīti — pārlādē lapu",
  invalid_target: "Nepareizs avota bloks",
  missing_file: "Fails netika nosūtīts",
  invalid_file_type: "Tikai PDF",
  file_too_large: "PDF fails pārāk liels",
  payload_too_large: "Pieprasījums pārāk liels — pārlādē lapu un mēģini vēlreiz",
  extraction_failed: "Neizdevās nolasīt PDF",
  blob_fetch_failed: "Neizdevās nolasīt PDF no krātuves",
  blob_token_missing: "Serverī nav BLOB_READ_WRITE_TOKEN — lielus PDF nevar apstrādāt",
};

/** Kļūda vienmēr ir atpazīstama: apraksts + servera kods, lai nav „kaut kas nogāja greizi”. */
function describeUploadError(
  status: number,
  data: { error?: string; detail?: string },
): string {
  const code = (data.error ?? "").trim();
  const detail = (data.detail ?? "").trim();
  const label = ERROR_LABELS[code] ?? (code ? `Servera kļūda: ${code}` : `Servera kļūda (HTTP ${status})`);
  return detail && detail !== label ? `${label} — ${detail}` : label;
}

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
        fd.set("target", target);
        fd.set("sessionId", sessionId);
        fd.set("sourceBlocks", JSON.stringify(getSourceBlocks()));
        if (sourcePdfNeedsBlobUpload(file)) {
          setNotice(`„${file.name}” (${Math.round(file.size / (1024 * 1024))} MB) — augšupielāde krātuvē…`);
          const ref = await uploadSourcePdfToBlob(sessionId, file);
          fd.set("fileUrls", JSON.stringify([ref]));
          setNotice(null);
        } else {
          fd.set("file", file);
        }

        const res = await fetch("/api/admin/copilot/vendor-pdf", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as AgentResponse;
        if (!res.ok || !data.ok) {
          setError(describeUploadError(res.status, data));
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
      } catch (e) {
        setNotice(null);
        setError(
          e instanceof SourcePdfBlobUploadError
            ? e.message
            : "Neizdevās savienoties ar serveri",
        );
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
          Copilot lasa PDF (teksta slānis + Claude Opus, līdz ~1 min)…
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

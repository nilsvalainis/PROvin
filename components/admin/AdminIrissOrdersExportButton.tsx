"use client";

import { useCallback, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

function parseFilenameFromDisposition(cd: string | null): string | null {
  if (!cd) return null;
  const m = /filename\*?=(?:UTF-8''|")?([^";\n]+)"?/i.exec(cd);
  return m?.[1]?.trim() ? decodeURIComponent(m[1].replace(/"/g, "")) : null;
}

type ExportFormat = "zip" | "json" | "pdf";

function fallbackName(format: ExportFormat): string {
  const day = new Date().toISOString().slice(0, 10);
  if (format === "pdf") return `provin-pasutijumu-saraksts-${day}.pdf`;
  if (format === "json") return `provin-iriss-pasutijumi-backup-${day}.json`;
  return `provin-iriss-pasutijumi-backup-${day}.zip`;
}

export function AdminIrissOrdersExportButton({
  compact = false,
  menu = false,
}: {
  compact?: boolean;
  menu?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "loading" | "error">("idle");
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const runExport = useCallback(async (format: ExportFormat) => {
    setErrMsg(null);
    setPhase("loading");
    setLoadingFormat(format);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/export?format=${format}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          try {
            const j = (await res.json()) as { message?: string; error?: string };
            if (j.message) detail = j.message;
            else if (j.error) detail = j.error;
          } catch {
            /* ignore */
          }
        }
        throw new Error(detail);
      }
      const blob = await res.blob();
      if (blob.size < 32) throw new Error("Tukšs fails - eksports neizdevās.");
      const fromHeader = parseFilenameFromDisposition(res.headers.get("Content-Disposition"));
      const filename = fromHeader || fallbackName(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPhase("idle");
      setLoadingFormat(null);
    } catch (e) {
      setPhase("error");
      setLoadingFormat(null);
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const busy = phase === "loading";

  if (menu) {
    return (
      <>
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={() => void runExport("pdf")}
          className="iriss-ov-item flex min-h-11 w-full items-center px-3.5 text-left text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--fill)] disabled:opacity-40"
        >
          {loadingFormat === "pdf" ? "PDF…" : "PDF"}
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={() => void runExport("zip")}
          className="iriss-ov-item flex min-h-11 w-full items-center px-3.5 text-left text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--fill)] disabled:opacity-40"
        >
          {loadingFormat === "zip" ? "ZIP…" : "ZIP"}
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={() => void runExport("json")}
          className="iriss-ov-item flex min-h-11 w-full items-center px-3.5 text-left text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--fill)] disabled:opacity-40"
        >
          {loadingFormat === "json" ? "Eksportē backup…" : "Eksportēt backup"}
        </button>
        {phase === "error" && errMsg ? (
          <p className="px-3.5 pb-2 text-[12px] leading-snug text-[var(--bad)]" role="alert">
            {errMsg}
          </p>
        ) : null}
      </>
    );
  }

  const btnClass = compact
    ? "inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200/90 bg-white px-2 text-[11px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-[var(--color-provin-accent)]/35 hover:bg-slate-50/90 disabled:opacity-55"
    : "inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-[var(--color-provin-accent)]/35 hover:bg-slate-50/90 disabled:opacity-55";
  const iconClass = compact ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0";

  return (
    <div className={compact ? "flex flex-col items-end gap-1" : "mb-3 flex flex-col items-end gap-1.5"}>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runExport("pdf")}
          className={btnClass}
          title="PDF - tikai aktīvie pasūtījumi"
        >
          {loadingFormat === "pdf" ? (
            <Loader2 className={`${iconClass} animate-spin text-[var(--color-provin-accent)]`} aria-hidden />
          ) : (
            <FileText className={`${iconClass} text-[var(--color-provin-accent)]`} aria-hidden />
          )}
          {compact ? "PDF" : "Saraksts PDF"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runExport("zip")}
          className={btnClass}
          title="ZIP rezerves kopija ar visiem melnrakstiem"
        >
          {loadingFormat === "zip" ? (
            <Loader2 className={`${iconClass} animate-spin text-[var(--color-provin-accent)]`} aria-hidden />
          ) : (
            <Download className={`${iconClass} text-[var(--color-provin-accent)]`} aria-hidden />
          )}
          {compact ? "ZIP" : "Eksportēt visus pasūtījumus"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runExport("json")}
          className={
            compact
              ? "inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 text-[11px] font-medium text-slate-500 transition hover:text-[var(--color-apple-text)] disabled:opacity-55"
              : btnClass
          }
          title="Rezerves kopija: visi pasūtījumi un piedāvājumi, ieskaitot attēlus"
        >
          {loadingFormat === "json" ? (
            <Loader2 className={`${iconClass} animate-spin text-[var(--color-provin-accent)]`} aria-hidden />
          ) : compact ? null : (
            <Download className={`${iconClass} text-[var(--color-provin-accent)]`} aria-hidden />
          )}
          Eksportēt backup
        </button>
      </div>
      {phase === "error" && errMsg ? (
        <p className="max-w-md text-right text-[11px] leading-snug text-red-600" role="alert">
          {errMsg}
        </p>
      ) : compact ? null : (
        <p className="max-w-lg text-right text-[10px] leading-snug text-[var(--color-provin-muted)]">
          PDF - tikai aktīvie pasūtījumi (klients, specifikācija, aprīkojums, piezīmes). ZIP/JSON - rezerves kopija
          ar visiem melnrakstiem.
        </p>
      )}
    </div>
  );
}

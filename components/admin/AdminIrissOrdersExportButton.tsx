"use client";

import { useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";

function parseFilenameFromDisposition(cd: string | null): string | null {
  if (!cd) return null;
  const m = /filename\*?=(?:UTF-8''|")?([^";\n]+)"?/i.exec(cd);
  return m?.[1]?.trim() ? decodeURIComponent(m[1].replace(/"/g, "")) : null;
}

export function AdminIrissOrdersExportButton() {
  const [phase, setPhase] = useState<"idle" | "loading" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const runExport = useCallback(async (format: "zip" | "json") => {
    setErrMsg(null);
    setPhase("loading");
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/export?format=${format}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const j = (await res.json()) as { message?: string; error?: string };
          if (j.message) detail = j.message;
          else if (j.error) detail = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const fromHeader = parseFilenameFromDisposition(res.headers.get("Content-Disposition"));
      const fallback =
        format === "zip"
          ? `provin-iriss-pasutijumi-backup-${new Date().toISOString().slice(0, 10)}.zip`
          : `provin-iriss-pasutijumi-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const filename = fromHeader || fallback;
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
    } catch (e) {
      setPhase("error");
      setErrMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <div className="mb-3 flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={phase === "loading"}
          onClick={() => void runExport("zip")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-[var(--color-provin-accent)]/35 hover:bg-slate-50/90 disabled:opacity-55"
        >
          {phase === "loading" ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--color-provin-accent)]" aria-hidden />
          ) : (
            <Download className="h-4 w-4 shrink-0 text-[var(--color-provin-accent)]" aria-hidden />
          )}
          Eksportēt visus pasūtījumus
        </button>
        <button
          type="button"
          disabled={phase === "loading"}
          onClick={() => void runExport("json")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90 disabled:opacity-55"
          title="Viens JSON fails (melnraksti + PDF + Stripe + demo snapshots)"
        >
          Vienā JSON
        </button>
      </div>
      {phase === "error" && errMsg ? (
        <p className="max-w-md text-right text-[11px] leading-snug text-red-600" role="alert">
          {errMsg}
        </p>
      ) : (
        <p className="max-w-md text-right text-[10px] leading-snug text-[var(--color-provin-muted)]">
          Rezerves kopija: melnraksts, rēķinu PDF (ja ir), Stripe apmaksātās sesijas, demo (ja ieslēgts).
        </p>
      )}
    </div>
  );
}

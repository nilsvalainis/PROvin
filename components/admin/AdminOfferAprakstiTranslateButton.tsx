"use client";

/**
 * "Tulkot ar AI" - piedāvājuma Apraksti lauku tulkojums latviski. Tikai Gemini
 * (/api/admin/iriss-pasutijumi/apraksti-translate), nekad Opus/Sonnet. Darbojas
 * tikai pēc klikšķa - nekad automātiski lauka atvēršanas vai rediģēšanas brīdī.
 */

import { Languages, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";
import { adminRichHtmlToPlainText, plainTextToMinimalRichHtml } from "@/lib/admin-rich-comment-html";

export function AdminOfferAprakstiTranslateButton({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalHtml, setOriginalHtml] = useState("");

  const plainText = adminRichHtmlToPlainText(value);
  const canRun = Boolean(plainText.trim()) && !disabled && !loading;

  const run = useCallback(async () => {
    if (!canRun) return;
    const t = plainText.trim();
    setOriginalHtml(value);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/iriss-pasutijumi/apraksti-translate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = (await res.json().catch(() => ({}))) as { lv?: string; error?: string };
      if (!res.ok || !data.lv) {
        setError(
          data.error === "missing_gemini_key"
            ? "AI tulkojumam nepieciešama Gemini atslēga."
            : "AI: tulkojums neizdevās",
        );
        return;
      }
      onChange(plainTextToMinimalRichHtml(data.lv));
    } catch {
      setError("AI: neizdevās savienoties");
    } finally {
      setLoading(false);
    }
  }, [canRun, onChange, plainText, value]);

  const canUndo = originalHtml !== "";
  const handleUndo = useCallback(() => {
    if (!originalHtml) return;
    onChange(originalHtml);
    setOriginalHtml("");
  }, [originalHtml, onChange]);

  return (
    <div className="inline-flex items-center gap-1">
      {canUndo ? (
        <button
          type="button"
          onClick={handleUndo}
          disabled={disabled}
          className="inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-200/80 bg-transparent px-2 text-[10px] font-medium text-slate-500 shadow-none transition hover:border-slate-300 hover:bg-slate-50/80 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          title="Atgriezt tekstu pirms tulkojuma"
        >
          <RotateCcw className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          Atgriezt
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void run()}
        disabled={!canRun}
        aria-busy={loading}
        title="Tulkot latviski (Gemini)"
        className="inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-200/80 bg-transparent px-2 text-[10px] font-semibold text-blue-600 shadow-none transition hover:border-slate-300 hover:bg-slate-50/80 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        Tulkot ar AI
      </button>
      {error ? (
        <span className="truncate text-[9px] text-amber-800/90" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

"use client";

/**
 * ✨ gramatikas labošana (Gemini) + bagātinātais teksts (`AdminRichCommentField`).
 */

import { useCallback, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { AdminRichCommentField } from "@/components/admin/AdminInternalRichCommentEditor";
import {
  ADMIN_AI_POLISH_BTN_CLASS,
  ADMIN_AI_POLISH_SPARKLE_CLASS,
  ADMIN_AI_POLISH_SPINNER_CLASS,
} from "@/components/admin/admin-ai-polish-ui";
import { adminRichHtmlToPlainText, plainTextToMinimalRichHtml } from "@/lib/admin-rich-comment-html";

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  compact?: boolean;
  "aria-label"?: string;
};

export function AdminAiPolishRichCommentShell({
  value,
  onChange,
  disabled,
  compact,
  "aria-label": ariaLabel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalHtml, setOriginalHtml] = useState("");

  const plainForPolish = adminRichHtmlToPlainText(value);

  const run = useCallback(async () => {
    if (disabled || loading) return;
    const t = plainForPolish.trim();
    if (!t) return;
    setOriginalHtml(value);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-polish-lv", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = (await res.json()) as { text?: string; error?: string; detail?: string };
      if (!res.ok) {
        const detail = typeof data.detail === "string" ? data.detail.trim() : "";
        if (data.error === "missing_gemini_key") setError("Nav GEMINI_API_KEY");
        else if (res.status === 401 || data.error === "unauthorized") setError("Gemini: nav admin piekļuves");
        else if (data.error === "polish_failed") {
          setError(detail ? `Gemini: neizdevās labot gramatiku — ${detail}` : "Gemini: neizdevās labot gramatiku");
        } else setError(detail ? `Gemini: ${detail}` : "Gemini: neizdevās");
        return;
      }
      if (typeof data.text === "string") {
        onChange(plainTextToMinimalRichHtml(data.text));
      }
    } catch {
      setError("Gemini: neizdevās savienoties");
    } finally {
      setLoading(false);
    }
  }, [disabled, loading, plainForPolish, onChange, value]);

  const canUndo = originalHtml !== "";

  const handleUndo = useCallback(() => {
    if (!originalHtml) return;
    onChange(originalHtml);
    setOriginalHtml("");
  }, [originalHtml, onChange]);

  return (
    <div className="w-full min-w-0">
      <div className={`relative ${compact ? "rounded-md pt-8 pr-8" : "rounded-md pt-8 pr-9"}`}>
        <AdminRichCommentField
          variant={compact ? "compact" : "default"}
          value={value}
          onChange={onChange}
          aria-label={ariaLabel}
        />
        <button
          type="button"
          className={ADMIN_AI_POLISH_BTN_CLASS}
          onClick={() => void run()}
          disabled={disabled || loading || !plainForPolish.trim()}
          title="Labot gramatiku (Gemini)"
          aria-busy={loading}
          aria-label="Labot gramatiku"
        >
          {loading ? (
            <Loader2 className={ADMIN_AI_POLISH_SPINNER_CLASS} aria-hidden />
          ) : (
            <span className={ADMIN_AI_POLISH_SPARKLE_CLASS} aria-hidden>
              ✨
            </span>
          )}
        </button>
        {error ? (
          <p
            className="pointer-events-none absolute bottom-1 left-0 right-10 truncate text-[9px] text-amber-800/90"
            title="Projektā nepieciešams GEMINI_API_KEY."
          >
            {error}
          </p>
        ) : null}
      </div>
      {canUndo ? (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={handleUndo}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-transparent px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-none transition hover:border-slate-300 hover:bg-slate-50/80 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            title="Atgriezt tekstu pirms pēdējās AI labošanas"
          >
            <RotateCcw className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            Atgriezt oriģinālu
          </button>
        </div>
      ) : null}
    </div>
  );
}

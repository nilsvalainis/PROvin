"use client";

/**
 * ✨ gramatikas labošana (AI) + bagātinātais teksts (`AdminRichCommentField`).
 */

import { useCallback, useState, type ReactNode } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { AdminFieldResetButton } from "@/components/admin/AdminFieldResetButton";
import { AdminRichCommentField } from "@/components/admin/AdminInternalRichCommentEditor";
import {
  ADMIN_AI_POLISH_BTN_CLASS,
  ADMIN_AI_POLISH_SPARKLE_CLASS,
  ADMIN_AI_POLISH_SPINNER_CLASS,
} from "@/components/admin/admin-ai-polish-ui";
import { adminRichHtmlToPlainText, plainTextToMinimalRichHtml } from "@/lib/admin-rich-comment-html";
import { formatAdminAiFetchError, parseAdminAiResponse } from "@/lib/admin-ai-client-errors";

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  compact?: boolean;
  /** False, ja × jau ir pie lauka etiķetes (piem. avota komentāri). */
  showReset?: boolean;
  "aria-label"?: string;
  /** Virsraksts formatēšanas rindā. */
  label?: ReactNode;
  /** Ģenerēšanas pogas tajā pašā rindā. */
  actions?: ReactNode;
};

export function AdminAiPolishRichCommentShell({
  value,
  onChange,
  disabled,
  compact,
  showReset = true,
  "aria-label": ariaLabel,
  label,
  actions,
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
      const { data, parseFailed } = await parseAdminAiResponse(res);
      if (!res.ok) {
        setError(
          parseFailed
            ? `AI: servera atbilde nav lasāma (HTTP ${res.status})`
            : formatAdminAiFetchError(data, res, "AI: neizdevās labot gramatiku"),
        );
        return;
      }
      if (typeof data.text === "string") {
        onChange(plainTextToMinimalRichHtml(data.text));
      }
    } catch {
      setError("AI: neizdevās savienoties");
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

  const canClear = Boolean(plainForPolish.trim());

  const toolbarEnd = (
    <>
      {actions}
      {canUndo ? (
        <button
          type="button"
          onClick={handleUndo}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-transparent px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-none transition hover:border-slate-300 hover:bg-slate-50/80 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          title="Atgriezt tekstu pirms pēdējās AI labošanas"
        >
          <RotateCcw className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          Atgriezt
        </button>
      ) : null}
      {showReset ? (
        <AdminFieldResetButton
          disabled={disabled || !canClear}
          title="Nodzēst komentāru"
          aria-label={ariaLabel ? `Nodzēst: ${ariaLabel}` : "Nodzēst komentāru"}
          onClick={() => {
            onChange("");
            setOriginalHtml("");
            setError(null);
          }}
        />
      ) : null}
      <button
        type="button"
        className={ADMIN_AI_POLISH_BTN_CLASS}
        onClick={() => void run()}
        disabled={disabled || loading || !plainForPolish.trim()}
        title="Labot gramatiku (AI)"
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
    </>
  );

  return (
    <div className="w-full min-w-0">
      <AdminRichCommentField
        variant={compact ? "compact" : "default"}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        label={label}
        toolbarEnd={toolbarEnd}
      />
      {error ? (
        <p className="mt-0.5 truncate text-[9px] text-amber-800/90" title="Projektā nepieciešams ANTHROPIC_API_KEY.">
          {error}
        </p>
      ) : null}
    </div>
  );
}

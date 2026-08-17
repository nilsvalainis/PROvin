"use client";

/**
 * Gramatikas ✨ (AI) — tikai UI. Pieprasījumi iet uz `/api/admin/ai-polish-lv`.
 */

import { Loader2, RotateCcw } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useState,
  type ReactElement,
  type TextareaHTMLAttributes,
} from "react";
import { AdminFieldResetButton, ADMIN_FIELD_RESET_ABS_CLASS } from "@/components/admin/AdminFieldResetButton";
import {
  ADMIN_AI_POLISH_BTN_CLASS,
  ADMIN_AI_POLISH_SPARKLE_CLASS,
  ADMIN_AI_POLISH_SPINNER_CLASS,
} from "@/components/admin/admin-ai-polish-ui";
import { formatAdminAiFetchError, parseAdminAiResponse } from "@/lib/admin-ai-client-errors";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function AdminAiPolishTextareaShell({
  value,
  onPolished,
  onClear,
  showReset = true,
  disabled,
  children,
}: {
  value: string;
  onPolished: (next: string) => void;
  /** Nodzēš tikai šo lauku; ja nav, izmanto `onPolished("")`. */
  onClear?: () => void;
  showReset?: boolean;
  disabled?: boolean;
  children: ReactElement<TextareaProps>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState("");

  const run = useCallback(async () => {
    if (disabled || loading) return;
    const t = value.trim();
    if (!t) return;
    setOriginalText(value);
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
        onPolished(data.text);
      }
    } catch {
      setError("AI: neizdevās savienoties");
    } finally {
      setLoading(false);
    }
  }, [disabled, loading, onPolished, value]);

  const canUndo = originalText !== "";

  const handleUndo = useCallback(() => {
    if (!originalText) return;
    onPolished(originalText);
    setOriginalText("");
  }, [originalText, onPolished]);

  if (!isValidElement(children)) {
    return children;
  }

  const ta = children as ReactElement<TextareaProps>;
  const mergedClass = [ta.props.className, showReset ? "pt-8 pr-14" : "pt-8 pr-9"].filter(Boolean).join(" ");
  const canClear = Boolean(value.trim());

  return (
    <div className="w-full min-w-0">
      <div className="relative">
        {cloneElement(ta, { className: mergedClass })}
        {showReset ? (
          <span className={ADMIN_FIELD_RESET_ABS_CLASS}>
            <AdminFieldResetButton
              disabled={disabled || !canClear}
              title="Nodzēst lauku"
              onClick={() => {
                if (onClear) onClear();
                else onPolished("");
                setOriginalText("");
                setError(null);
              }}
            />
          </span>
        ) : null}
        <button
          type="button"
          className={ADMIN_AI_POLISH_BTN_CLASS}
          onClick={() => void run()}
          disabled={disabled || loading || !value.trim()}
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
        {error ? (
          <p
            className="pointer-events-none absolute bottom-0 left-0 right-8 truncate text-[9px] text-amber-800/90"
            title="Projektā nepieciešams ANTHROPIC_API_KEY (.env.local / Vercel)."
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

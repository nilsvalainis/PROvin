"use client";

/**
 * Gramatikas ✨ — tikai UI. Pieprasījumi iet uz `/api/admin/ai-polish-lv`; `GROQ_API_KEY` paliek serverī.
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

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Augšējā labajā stūrī — ✨ AI gramatikas labošana (LV). Bērns: viens `<textarea>`.
 * Iekšējā atstarpe, lai teksts nepārklājas ar ikonu.
 */
export function AdminAiPolishTextareaShell({
  value,
  onPolished,
  disabled,
  children,
}: {
  value: string;
  onPolished: (next: string) => void;
  disabled?: boolean;
  children: ReactElement<TextareaProps>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Teksts pirms pēdējās veiksmīgās AI labošanas (pilna textarea vērtība). */
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
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        if (data.error === "missing_groq_key") {
          setError("Nav GROQ_API_KEY");
        } else if (res.status === 401 || data.error === "unauthorized") {
          setError("Groq: nav admin piekļuves");
        } else if (data.error === "polish_failed") {
          setError("Groq: neizdevās apstrādāt tekstu");
        } else {
          setError("Groq: neizdevās");
        }
        return;
      }
      if (typeof data.text === "string") {
        onPolished(data.text);
      }
    } catch {
      setError("Groq: neizdevās savienoties");
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
  const mergedClass = [ta.props.className, "pt-8 pr-9"].filter(Boolean).join(" ");

  return (
    <div className="w-full min-w-0">
      <div className="relative">
        {cloneElement(ta, { className: mergedClass })}
        <button
          type="button"
          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-none border-0 bg-transparent p-0 text-[15px] leading-none text-[#0061D2] shadow-none transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
          onClick={() => void run()}
          disabled={disabled || loading || !value.trim()}
          title="Labot gramatiku"
          aria-busy={loading}
          aria-label="Labot gramatiku"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#0061D2]" aria-hidden />
          ) : (
            <span aria-hidden>✨</span>
          )}
        </button>
        {error ? (
          <p
            className="pointer-events-none absolute bottom-0 left-0 right-8 truncate text-[9px] text-amber-800/90"
            title="Projekta saknē (mapē ar package.json) izveido vai papildini .env.local: GROQ_API_KEY=… (console.groq.com) — pēc tam restartē npm run dev. Produkcijā: Vercel → Environment Variables."
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

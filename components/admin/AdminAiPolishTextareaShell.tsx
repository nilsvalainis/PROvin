"use client";

import { Loader2 } from "lucide-react";
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
 * Apakšējā labajā stūrī — ✨ AI gramatikas labošana (LV). Bērns: viens `<textarea>`.
 * Pievieno iekšējo atstarpi, lai teksts nepārklājas ar pogu.
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

  const run = useCallback(async () => {
    if (disabled || loading) return;
    const t = value.trim();
    if (!t) return;
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
        if (data.error === "missing_openai_key") {
          setError("Nav OPENAI_API_KEY");
        } else {
          setError("Neizdevās");
        }
        return;
      }
      if (typeof data.text === "string") {
        onPolished(data.text);
      }
    } catch {
      setError("Tīkls");
    } finally {
      setLoading(false);
    }
  }, [disabled, loading, onPolished, value]);

  if (!isValidElement(children)) {
    return children;
  }

  const ta = children as ReactElement<TextareaProps>;
  const mergedClass = [ta.props.className, "pb-8 pr-9"].filter(Boolean).join(" ");

  return (
    <div className="relative">
      {cloneElement(ta, { className: mergedClass })}
      <button
        type="button"
        className="absolute bottom-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200/60 bg-white/55 text-[13px] text-amber-600/90 shadow-sm backdrop-blur-sm transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => void run()}
        disabled={disabled || loading || !value.trim()}
        title="AI: labot latviešu gramatiku un stilu"
        aria-busy={loading}
        aria-label="AI: labot latviešu gramatiku un stilu"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-600" aria-hidden /> : <span aria-hidden>✨</span>}
      </button>
      {error ? (
        <p className="pointer-events-none absolute bottom-0 left-0 right-10 truncate text-[9px] text-amber-800/90" title={error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

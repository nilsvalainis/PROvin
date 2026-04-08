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
          setError("Nav OPENAI_API_KEY (.env.local)");
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
  const mergedClass = [ta.props.className, "pt-8 pr-9"].filter(Boolean).join(" ");

  return (
    <div className="relative">
      {cloneElement(ta, { className: mergedClass })}
      <button
        type="button"
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-none border-0 bg-transparent p-0 text-[15px] leading-none text-[#0061D2] shadow-none transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
        onClick={() => void run()}
        disabled={disabled || loading || !value.trim()}
        title="AI: labot latviešu gramatiku un stilu"
        aria-busy={loading}
        aria-label="AI: labot latviešu gramatiku un stilu"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#0061D2]" aria-hidden />
        ) : (
          <span aria-hidden>✨</span>
        )}
      </button>
      {error ? (
        <p className="pointer-events-none absolute bottom-0 left-0 right-8 truncate text-[9px] text-amber-800/90" title={error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

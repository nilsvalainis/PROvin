"use client";

import { useCallback, useState } from "react";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7V5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2H8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const adminCompactCopyBtnClass =
  "inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-[var(--color-apple-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-35";

export function copyTextViaExecCommand(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return copyTextViaExecCommand(text);
}

type Props = {
  value: string;
  onCopied?: () => void;
  titleReady: string;
  titleCopied: string;
  ariaReady: string;
  ariaCopied: string;
};

/** Kompakta Copy poga (28×28), saskaņota ar VIN / URL laukiem. */
export function AdminClipboardButton({ value, onCopied, titleReady, titleCopied, ariaReady, ariaCopied }: Props) {
  const [copied, setCopied] = useState(false);
  const trimmed = value.trim();
  const canCopy = trimmed.length > 0;

  const onCopy = useCallback(async () => {
    if (!canCopy) return;
    const ok = await copyTextToClipboard(trimmed);
    if (ok) {
      onCopied?.();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, [canCopy, trimmed, onCopied]);

  return (
    <button
      type="button"
      className={adminCompactCopyBtnClass}
      disabled={!canCopy}
      onClick={() => void onCopy()}
      title={copied ? titleCopied : titleReady}
      aria-label={copied ? ariaCopied : ariaReady}
    >
      {copied ? (
        <span className="text-[10px] font-bold text-emerald-700" aria-hidden>
          OK
        </span>
      ) : (
        <CopyIcon className="shrink-0" />
      )}
    </button>
  );
}

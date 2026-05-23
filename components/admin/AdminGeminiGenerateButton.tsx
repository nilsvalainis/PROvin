"use client";

import { Loader2 } from "lucide-react";

type Props = {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  demoOnly?: boolean;
  title?: string;
  onClick: () => void;
};

export function AdminGeminiGenerateButton({
  label,
  disabled,
  busy,
  demoOnly,
  title,
  onClick,
}: Props) {
  const hint =
    title ??
    (demoOnly
      ? "Gemini AI pieejams tikai DEMO pasūtījumiem (drošības iemesli)"
      : undefined);

  return (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-violet-700 bg-violet-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled || busy}
      onClick={onClick}
      title={hint}
      aria-busy={busy}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
      {label}
    </button>
  );
}

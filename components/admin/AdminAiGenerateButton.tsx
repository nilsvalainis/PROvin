"use client";

import { Loader2 } from "lucide-react";

import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";

type Props = {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  demoOnly?: boolean;
  title?: string;
  variant?: AiAdminModelTier;
  onClick: () => void;
};

const VARIANT_CLASS: Record<AiAdminModelTier, string> = {
  pro: "border border-violet-700 bg-violet-600 text-white hover:bg-violet-700",
  flash: "border border-emerald-700/70 bg-emerald-600 text-white hover:bg-emerald-700",
  lite: "border border-sky-700/70 bg-sky-600 text-white hover:bg-sky-700",
};

const VARIANT_HINT: Record<AiAdminModelTier, string> = {
  pro: "Claude Opus — dziļāka eksperta analīze (dārgākais)",
  flash: "Claude Sonnet — vidējā kvalitāte un cena",
  lite: "Claude Haiku — lētākais; īsiem komentāriem, kad dati jau ir tabulā",
};

export function AdminAiGenerateButton({
  label,
  disabled,
  busy,
  demoOnly,
  title,
  variant = "pro",
  onClick,
}: Props) {
  const hint = title ?? (demoOnly ? "AI pieejams tikai DEMO pasūtījumiem (drošības iemesli)" : VARIANT_HINT[variant]);

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASS[variant]}`}
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

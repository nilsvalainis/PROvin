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
  /** Mazs „AI” marķieris ieteiktajai (pirmajai) pogai. */
  badge?: boolean;
  onClick: () => void;
};

/** Per-modeļa krāsas — operatori atpazīst aģentu pēc pogas. */
export const ADMIN_AI_TIER_BTN_CLASS: Record<AiAdminModelTier, string> = {
  pro: "border border-violet-700/70 bg-violet-600/95 text-white hover:bg-violet-600 hover:brightness-105 focus-visible:ring-violet-500/35",
  flash: "border border-emerald-700/70 bg-emerald-600/95 text-white hover:bg-emerald-600 hover:brightness-105 focus-visible:ring-emerald-500/35",
  lite: "border border-sky-700/70 bg-sky-600/95 text-white hover:bg-sky-600 hover:brightness-105 focus-visible:ring-sky-500/35",
  gemini: "border border-amber-700/70 bg-amber-600/95 text-white hover:bg-amber-600 hover:brightness-105 focus-visible:ring-amber-500/35",
  "gemini-flash":
    "border border-teal-700/70 bg-teal-600/95 text-white hover:bg-teal-600 hover:brightness-105 focus-visible:ring-teal-500/35",
};

export const ADMIN_AI_BADGE_CLASS =
  "provin-ai-badge rounded px-1 py-px text-[9px] font-bold tracking-[0.05em] bg-white/25 text-inherit";

const VARIANT_HINT: Record<AiAdminModelTier, string> = {
  pro: "Claude Opus — dārgākais; tikai kopsavilkumam vai apzinātai dziļai analīzei",
  flash: "Claude Sonnet — nobraukums, negadījumi, riski, cena",
  lite: "Claude Haiku + Sonnet gramatika",
  gemini: "Gemini 2.5 Pro — vidēji smagi Gemini lauki",
  "gemini-flash": "Gemini 3 Flash — ieteicams avotu komentāriem (lētākais)",
};

export function AdminAiGenerateButton({
  label,
  disabled,
  busy,
  demoOnly,
  title,
  variant = "pro",
  badge = false,
  onClick,
}: Props) {
  const hint = title ?? (demoOnly ? "AI pieejams tikai DEMO pasūtījumiem (drošības iemesli)" : VARIANT_HINT[variant]);

  return (
    <button
      type="button"
      data-ai-tier={variant}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${ADMIN_AI_TIER_BTN_CLASS[variant]}`}
      disabled={disabled || busy}
      onClick={onClick}
      title={hint}
      aria-busy={busy}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
      {badge && !busy ? (
        <span className={ADMIN_AI_BADGE_CLASS} aria-hidden>
          AI
        </span>
      ) : null}
      {label}
    </button>
  );
}

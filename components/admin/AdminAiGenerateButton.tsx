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

/** Visi modeļi vizuāli vienādi klusi; modeļa nosaukums ir pogas tekstā un `title`. */
export const ADMIN_AI_BTN_QUIET_CLASS =
  "provin-ai-btn border border-[#d2d2d7] bg-transparent text-[#6e6e73] shadow-none hover:border-[rgba(175,82,222,0.45)] hover:bg-[rgba(175,82,222,0.10)] hover:text-[#7d3fa0] focus-visible:border-[rgba(175,82,222,0.45)] focus-visible:bg-[rgba(175,82,222,0.10)] focus-visible:text-[#7d3fa0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(175,82,222,0.25)]";

export const ADMIN_AI_BADGE_CLASS =
  "provin-ai-badge rounded px-1 py-px text-[9px] font-bold tracking-[0.05em] bg-[#f2f2f7] text-current";

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
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${ADMIN_AI_BTN_QUIET_CLASS}`}
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

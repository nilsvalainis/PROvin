"use client";

import { AdminAiPolishRichCommentShell } from "@/components/admin/AdminAiPolishRichCommentShell";
import { AdminGeminiGenerateWithPrefill } from "@/components/admin/AdminGeminiGenerateWithPrefill";
import { AdminRichCommentReadonly } from "@/components/admin/AdminInternalRichCommentEditor";
import { LISTING_ANALYSIS_COMMENT_LABEL } from "@/lib/admin-source-blocks";

import type { GeminiAdminModelTier } from "@/lib/gemini-admin-model-tier";

export type AdminGeminiSourceCommentSlot = {
  allowed: boolean;
  busy: boolean;
  error: string | null;
  hasSourceData: boolean;
  onGenerate: (operatorNotes: string, modelTier: GeminiAdminModelTier) => void;
};

type Props = {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  compact?: boolean;
  "aria-label"?: string;
  readonlyClassName?: string;
  gemini?: AdminGeminiSourceCommentSlot;
};

export function AdminSourceCommentField({
  label = LISTING_ANALYSIS_COMMENT_LABEL,
  value,
  onChange,
  readOnly,
  disabled,
  compact,
  "aria-label": ariaLabel,
  readonlyClassName = "min-h-[40px] rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]",
  gemini,
}: Props) {
  return (
    <div className="w-full min-w-0">
      <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
        <span className="block text-[10px] font-medium text-[var(--color-provin-muted)]">{label}</span>
        {gemini && !readOnly ? (
          <AdminGeminiGenerateWithPrefill
            label="Ģenerēt komentāru"
            busy={gemini.busy}
            disabled={!gemini.allowed || !gemini.hasSourceData || disabled}
            demoOnly={!gemini.allowed}
            title={
              !gemini.allowed
                ? undefined
                : !gemini.hasSourceData
                  ? "Vispirms aizpildi šī avota datus (tabulas, laukus u.c.)"
                  : "No šī avota datiem ģenerē komentāru ar Gemini"
            }
            onGenerate={gemini.onGenerate}
          />
        ) : null}
      </div>
      {gemini?.error ? (
        <p className="mb-1 text-[9px] leading-snug text-amber-800/90" title={gemini.error}>
          {gemini.error}
        </p>
      ) : null}
      {readOnly ? (
        <AdminRichCommentReadonly html={value} className={readonlyClassName} />
      ) : (
        <AdminAiPolishRichCommentShell
          value={value}
          onChange={onChange}
          disabled={disabled}
          compact={compact}
          aria-label={ariaLabel}
        />
      )}
    </div>
  );
}

"use client";

import { AdminAiFieldError } from "@/components/admin/AdminAiFieldError";
import { AdminAiPolishRichCommentShell } from "@/components/admin/AdminAiPolishRichCommentShell";
import { AdminAiGenerateWithPrefill } from "@/components/admin/AdminAiGenerateWithPrefill";
import { AdminRichCommentReadonly } from "@/components/admin/AdminInternalRichCommentEditor";
import { LISTING_ANALYSIS_COMMENT_LABEL } from "@/lib/admin-source-blocks";

import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import type { ReactNode } from "react";

export type AdminAiSourceCommentSlot = {
  allowed: boolean;
  busy: boolean;
  error: string | null;
  hasSourceData: boolean;
  onGenerate: (operatorNotes: string, modelTier: AiAdminModelTier) => void;
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
  ai?: AdminAiSourceCommentSlot;
  headerExtra?: ReactNode;
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
  ai,
  headerExtra,
}: Props) {
  const title = label.trim();
  const titleNode = title ? (
    <span className="text-[10px] font-medium text-[var(--color-provin-muted)]">{title}</span>
  ) : null;
  const header =
    titleNode || headerExtra ? (
      <span className="flex min-w-0 items-center justify-between gap-2">
        {titleNode}
        {headerExtra}
      </span>
    ) : undefined;
  const generate =
    ai && !readOnly ? (
      <AdminAiGenerateWithPrefill
        label="Ģenerēt komentāru"
        busy={ai.busy}
        disabled={!ai.allowed || !ai.hasSourceData || disabled}
        demoOnly={!ai.allowed}
        title={
          !ai.allowed
            ? undefined
            : !ai.hasSourceData
              ? "Vispirms aizpildi šī avota datus (tabulas, laukus u.c.)"
              : "No šī avota datiem ģenerē komentāru ar AI"
        }
        onGenerate={ai.onGenerate}
      />
    ) : null;

  return (
    <div className="w-full min-w-0">
      <AdminAiFieldError message={ai?.error} />
      {readOnly ? (
        <>
          {header ? <span className="mb-0.5 block">{header}</span> : null}
          <AdminRichCommentReadonly html={value} className={readonlyClassName} />
        </>
      ) : (
        <AdminAiPolishRichCommentShell
          value={value}
          onChange={onChange}
          disabled={disabled}
          compact={compact}
          label={header}
          actions={generate}
          aria-label={ariaLabel}
        />
      )}
    </div>
  );
}

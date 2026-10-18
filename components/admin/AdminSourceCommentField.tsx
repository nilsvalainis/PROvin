"use client";

import { AdminAiFieldError } from "@/components/admin/AdminAiFieldError";
import { AdminFactCheckButton, AdminFactCheckPanel } from "@/components/admin/AdminFactCheckPanel";
import { AdminAiPolishRichCommentShell } from "@/components/admin/AdminAiPolishRichCommentShell";
import { AdminAiGenerateWithPrefill } from "@/components/admin/AdminAiGenerateWithPrefill";
import { AdminRichCommentReadonly } from "@/components/admin/AdminInternalRichCommentEditor";
import { LISTING_ANALYSIS_COMMENT_LABEL } from "@/lib/admin-source-blocks";
import { applyFactCheckFixToField } from "@/lib/fact-check-suggested-fix";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import type { ReactNode } from "react";

export type AdminFactCheckSlot = {
  busy: boolean;
  flags: FactCheckFlag[];
  dismissed: readonly string[];
  onCheck: () => void;
  onDismiss: (flag: FactCheckFlag) => void;
  onApplyFix?: (flag: FactCheckFlag) => void;
};

export type AdminAiSourceCommentSlot = {
  allowed: boolean;
  busy: boolean;
  error: string | null;
  hasSourceData: boolean;
  onGenerate: (operatorNotes: string, modelTier: AiAdminModelTier) => void;
  factCheck?: AdminFactCheckSlot | null;
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
      <span className="inline-flex flex-wrap items-center gap-1">
        {ai ? (
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
        ) : null}
        {ai?.factCheck ? (
          <AdminFactCheckButton
            busy={ai.factCheck.busy}
            disabled={disabled}
            onClick={ai.factCheck.onCheck}
          />
        ) : null}
      </span>
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
      {ai?.factCheck ? (
        <AdminFactCheckPanel
          flags={ai.factCheck.flags}
          dismissed={ai.factCheck.dismissed}
          onDismiss={ai.factCheck.onDismiss}
          onApplyFix={
            ai.factCheck.onApplyFix ??
            ((flag) => {
              onChange(applyFactCheckFixToField(value, flag));
              ai.factCheck?.onDismiss(flag);
            })
          }
        />
      ) : null}
    </div>
  );
}

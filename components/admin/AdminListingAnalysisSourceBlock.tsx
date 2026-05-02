"use client";

/**
 * Sludinājuma analīze: AI poga izsauc `POST /api/ai/analyze`; `GROQ_API_KEY` tikai API route serverī.
 */

import { Loader2 } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { AdminAiPolishRichCommentShell } from "@/components/admin/AdminAiPolishRichCommentShell";
import { AdminRichCommentReadonly } from "@/components/admin/AdminInternalRichCommentEditor";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { ListingAnalysisSubsectionHeading } from "@/components/admin/AdminListingAnalysisSectionChrome";
import {
  emptyListingAnalysisBlock,
  LISTING_ANALYSIS_COMMENT_LABEL,
  LISTING_ANALYSIS_LISTING_PASTE_LABEL,
  LISTING_ANALYSIS_SUBSECTIONS,
  type ListingAnalysisBlockState,
} from "@/lib/admin-source-blocks";
import { LISTING_ANALYSIS_FIELD_LUCIDE } from "@/lib/admin-lucide-registry";
import { plainTextToMinimalRichHtml } from "@/lib/admin-rich-comment-html";

const ta =
  "min-h-[72px] w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-[var(--color-provin-accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/20";

type Props = {
  value?: ListingAnalysisBlockState | null;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: ListingAnalysisBlockState) => void;
  /** Ārējā „SLUDINĀJUMA ANALĪZE” prioritārā josla — bez atkārtota bloka galvenes. */
  variant?: "default" | "priority";
  /** Zemāks augstums (admin kompaktais skats). */
  compact?: boolean;
  /** Teksta lauku augstums pēc scrollHeight (+ aptuveni viena rinda). */
  autoGrow?: boolean;
};

export function AdminListingAnalysisSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  variant = "default",
  compact = false,
  autoGrow = false,
}: Props) {
  const v = value ?? emptyListingAnalysisBlock();
  const L = LISTING_ANALYSIS_SUBSECTIONS;
  const fields: { key: "sellerPortrait" | "photoAnalysis"; title: string }[] = [
    { key: "sellerPortrait", title: L.sellerPortrait },
    { key: "photoAnalysis", title: L.photoAnalysis },
  ];

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);
  const refPaste = useRef<HTMLTextAreaElement>(null);

  const bumpTa = useCallback((el: HTMLTextAreaElement | null) => {
    if (!autoGrow || !el) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + lh}px`;
  }, [autoGrow]);

  useLayoutEffect(() => {
    if (!autoGrow || readOnly) return;
    bumpTa(refPaste.current);
  }, [autoGrow, readOnly, bumpTa, v.listingPasteRaw]);

  const runListingAnalyze = useCallback(async () => {
    const t = v.listingPasteRaw.trim();
    if (!t || disabled || analyzing) return;
    setAnalyzing(true);
    setAnalyzeErr(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        if (data.error === "missing_groq_key") {
          setAnalyzeErr("Nav GROQ_API_KEY");
        } else if (res.status === 401 || data.error === "unauthorized") {
          setAnalyzeErr("Groq: nav admin piekļuves");
        } else if (data.error === "analysis_failed") {
          setAnalyzeErr("Groq: neizdevās analizēt sludinājumu");
        } else {
          setAnalyzeErr("Groq: neizdevās");
        }
        return;
      }
      if (typeof data.text === "string") {
        onChange({ ...v, listingSalesContext: plainTextToMinimalRichHtml(data.text) });
      }
    } catch {
      setAnalyzeErr("Groq: neizdevās savienoties");
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, disabled, onChange, v]);

  const shell =
    variant === "priority"
      ? "w-full min-w-0 flex flex-col"
      : "flex h-full min-h-0 flex-col rounded-xl border-0 bg-transparent p-2 shadow-[0_2px_22px_rgba(15,23,42,0.055)]";

  const taPriority =
    "min-h-[72px] w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/25 dark:focus:border-emerald-400/80";
  const taPriorityCompact =
    "min-h-[52px] w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-1.5 py-1 text-[10px] leading-snug text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/25 dark:focus:border-emerald-400/80";

  const pri = variant === "priority";
  const dense = compact && pri;

  const pasteTaClass = pri ? (dense ? taPriorityCompact : taPriority) : ta;

  const roBox = (denseInner: boolean) =>
    denseInner
      ? "min-h-[32px] rounded border border-emerald-100/50 bg-transparent px-1.5 py-1 text-[10px] text-slate-500"
      : "min-h-[48px] rounded-md border border-emerald-100/50 bg-transparent px-2 py-1.5 text-[11px] text-slate-500";

  const roDefault = "min-h-[48px] rounded-md border border-slate-200/40 bg-transparent px-2 py-1.5 text-[11px] text-slate-500";

  return (
    <div className={shell}>
      {variant === "default" ? (
        <AdminSourceBlockHeader blockKey="listing_analysis" className="mb-1.5" />
      ) : null}
      <div className={dense ? "space-y-3" : "space-y-4"}>
        {fields.map(({ key, title }) => (
          <ListingAnalysisSubsectionHeading
            key={key}
            icon={LISTING_ANALYSIS_FIELD_LUCIDE[key]}
            title={title}
            compact={dense}
          >
            <p
              className={
                dense
                  ? "mb-0.5 text-[9px] font-medium text-slate-400"
                  : "mb-0.5 text-[10px] font-medium text-slate-400"
              }
            >
              {LISTING_ANALYSIS_COMMENT_LABEL}
            </p>
            {readOnly ? (
              <AdminRichCommentReadonly html={v[key]} className={pri ? roBox(!!dense) : roDefault} />
            ) : (
              <AdminAiPolishRichCommentShell
                value={v[key]}
                onChange={(next) => onChange({ ...v, [key]: next })}
                disabled={disabled}
                compact={pri && dense}
                aria-label={`${title} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
              />
            )}
          </ListingAnalysisSubsectionHeading>
        ))}

        <ListingAnalysisSubsectionHeading
          icon={LISTING_ANALYSIS_FIELD_LUCIDE.listingPasteRaw}
          title={LISTING_ANALYSIS_LISTING_PASTE_LABEL}
          compact={dense}
        >
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-700 bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={readOnly || disabled || analyzing || !v.listingPasteRaw.trim()}
              onClick={() => void runListingAnalyze()}
              title="Labot gramatiku — Groq aizpilda lauku „Pārdošanas sludinājuma konteksts”"
              aria-busy={analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              ) : null}
              Labot gramatiku 🤖
            </button>
          </div>
          {analyzeErr ? (
            <p className="mb-1.5 truncate text-[9px] text-amber-800/90" title={analyzeErr}>
              {analyzeErr}
            </p>
          ) : null}
          {readOnly ? (
            <div
              className={
                pri
                  ? dense
                    ? "min-h-[32px] whitespace-pre-wrap rounded border border-emerald-100/50 bg-transparent px-1.5 py-1 text-[10px] text-slate-500"
                    : "min-h-[48px] whitespace-pre-wrap rounded-md border border-emerald-100/50 bg-transparent px-2 py-1.5 text-[11px] text-slate-500"
                  : "min-h-[48px] whitespace-pre-wrap rounded-md border border-slate-200/40 bg-transparent px-2 py-1.5 text-[11px] text-slate-500"
              }
            >
              {v.listingPasteRaw.trim() || "—"}
            </div>
          ) : (
            <textarea
              ref={refPaste}
              className={`${pasteTaClass} ${autoGrow && !readOnly ? "resize-none overflow-hidden" : ""}`}
              disabled={disabled}
              rows={dense ? 2 : 4}
              value={v.listingPasteRaw}
              onChange={(e) => onChange({ ...v, listingPasteRaw: e.target.value })}
              placeholder=""
              aria-label={`${LISTING_ANALYSIS_LISTING_PASTE_LABEL} — ievade analīzei (nav PDF)`}
            />
          )}
        </ListingAnalysisSubsectionHeading>

        <ListingAnalysisSubsectionHeading
          icon={LISTING_ANALYSIS_FIELD_LUCIDE.listingSalesContext}
          title={L.listingSalesContext}
          compact={dense}
        >
          <p
            className={
              dense
                ? "mb-0.5 text-[9px] font-medium text-slate-400"
                : "mb-0.5 text-[10px] font-medium text-slate-400"
            }
          >
            {LISTING_ANALYSIS_COMMENT_LABEL}
          </p>
          {readOnly ? (
            <AdminRichCommentReadonly html={v.listingSalesContext} className={pri ? roBox(!!dense) : roDefault} />
          ) : (
            <AdminAiPolishRichCommentShell
              value={v.listingSalesContext}
              onChange={(next) => onChange({ ...v, listingSalesContext: next })}
              disabled={disabled}
              compact={pri && dense}
              aria-label={`${L.listingSalesContext} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
            />
          )}
        </ListingAnalysisSubsectionHeading>
      </div>
    </div>
  );
}

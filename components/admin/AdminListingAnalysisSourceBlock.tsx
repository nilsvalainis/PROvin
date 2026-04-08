"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { AdminAiPolishTextareaShell } from "@/components/admin/AdminAiPolishTextareaShell";
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

const ta =
  "min-h-[72px] w-full rounded-md border border-slate-200/50 bg-transparent px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/20";

type Props = {
  value?: ListingAnalysisBlockState | null;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: ListingAnalysisBlockState) => void;
  /** Ārējā „SLUDINĀJUMA ANALĪZE” prioritārā josla — bez atkārtota bloka galvenes. */
  variant?: "default" | "priority";
  /** Zemāks augstums (admin kompaktais skats). */
  compact?: boolean;
};

export function AdminListingAnalysisSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  variant = "default",
  compact = false,
}: Props) {
  const v = value ?? emptyListingAnalysisBlock();
  const L = LISTING_ANALYSIS_SUBSECTIONS;
  const fields: { key: "sellerPortrait" | "photoAnalysis"; title: string }[] = [
    { key: "sellerPortrait", title: L.sellerPortrait },
    { key: "photoAnalysis", title: L.photoAnalysis },
  ];

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);

  const runListingAnalyze = useCallback(async () => {
    const t = v.listingPasteRaw.trim();
    if (!t || disabled || analyzing) return;
    setAnalyzing(true);
    setAnalyzeErr(null);
    try {
      const res = await fetch("/api/admin/ai-listing-analysis-lv", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        if (data.error === "missing_gemini_key") {
          setAnalyzeErr("Nav GEMINI_API_KEY");
        } else {
          setAnalyzeErr("Neizdevās");
        }
        return;
      }
      if (typeof data.text === "string") {
        onChange({ ...v, listingSalesContext: data.text });
      }
    } catch {
      setAnalyzeErr("Tīkls");
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, disabled, onChange, v]);

  const shell =
    variant === "priority"
      ? "w-full min-w-0 flex flex-col"
      : "flex h-full min-h-0 flex-col rounded-xl border-0 bg-transparent p-2 shadow-[0_2px_22px_rgba(15,23,42,0.055)]";

  const taPriority =
    "min-h-[72px] w-full rounded-md border border-emerald-200/45 bg-transparent px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/20";
  const taPriorityCompact =
    "min-h-[52px] w-full rounded-md border border-emerald-200/45 bg-transparent px-1.5 py-1 text-[10px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/20";

  const pri = variant === "priority";
  const dense = compact && pri;

  const pasteTaClass = pri ? (dense ? taPriorityCompact : taPriority) : ta;

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
              <div
                className={
                  pri
                    ? dense
                      ? "min-h-[32px] whitespace-pre-wrap rounded border border-emerald-100/50 bg-transparent px-1.5 py-1 text-[10px] text-slate-500"
                      : "min-h-[48px] whitespace-pre-wrap rounded-md border border-emerald-100/50 bg-transparent px-2 py-1.5 text-[11px] text-slate-500"
                    : "min-h-[48px] whitespace-pre-wrap rounded-md border border-slate-200/40 bg-transparent px-2 py-1.5 text-[11px] text-slate-500"
                }
              >
                {v[key].trim() || "—"}
              </div>
            ) : (
              <AdminAiPolishTextareaShell
                value={v[key]}
                onPolished={(next) => onChange({ ...v, [key]: next })}
                disabled={disabled}
              >
                <textarea
                  className={pri ? (dense ? taPriorityCompact : taPriority) : ta}
                  disabled={disabled}
                  rows={dense ? 2 : 4}
                  value={v[key]}
                  onChange={(e) => onChange({ ...v, [key]: e.target.value })}
                  placeholder=""
                  aria-label={`${title} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
                />
              </AdminAiPolishTextareaShell>
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
              title="Analizēt ar Google Gemini — rezultāts lauks „Pārdošanas sludinājuma konteksts”"
              aria-busy={analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              ) : null}
              Analizēt ar AI 🤖
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
              className={pasteTaClass}
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
            <div
              className={
                pri
                  ? dense
                    ? "min-h-[32px] whitespace-pre-wrap rounded border border-emerald-100/50 bg-transparent px-1.5 py-1 text-[10px] text-slate-500"
                    : "min-h-[48px] whitespace-pre-wrap rounded-md border border-emerald-100/50 bg-transparent px-2 py-1.5 text-[11px] text-slate-500"
                  : "min-h-[48px] whitespace-pre-wrap rounded-md border border-slate-200/40 bg-transparent px-2 py-1.5 text-[11px] text-slate-500"
              }
            >
              {v.listingSalesContext.trim() || "—"}
            </div>
          ) : (
            <AdminAiPolishTextareaShell
              value={v.listingSalesContext}
              onPolished={(next) => onChange({ ...v, listingSalesContext: next })}
              disabled={disabled}
            >
              <textarea
                className={pri ? (dense ? taPriorityCompact : taPriority) : ta}
                disabled={disabled}
                rows={dense ? 2 : 4}
                value={v.listingSalesContext}
                onChange={(e) => onChange({ ...v, listingSalesContext: e.target.value })}
                placeholder=""
                aria-label={`${L.listingSalesContext} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
              />
            </AdminAiPolishTextareaShell>
          )}
        </ListingAnalysisSubsectionHeading>
      </div>
    </div>
  );
}

"use client";

import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { ListingAnalysisSubsectionHeading } from "@/components/admin/AdminListingAnalysisSectionChrome";
import {
  emptyListingAnalysisBlock,
  LISTING_ANALYSIS_COMMENT_LABEL,
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
  const fields: { key: keyof ListingAnalysisBlockState; title: string }[] = [
    { key: "sellerPortrait", title: L.sellerPortrait },
    { key: "photoAnalysis", title: L.photoAnalysis },
    { key: "listingDescription", title: L.listingDescription },
  ];

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
              <textarea
                className={pri ? (dense ? taPriorityCompact : taPriority) : ta}
                disabled={disabled}
                rows={dense ? 2 : 4}
                value={v[key]}
                onChange={(e) => onChange({ ...v, [key]: e.target.value })}
                placeholder=""
                aria-label={`${title} — Komentāri`}
              />
            )}
          </ListingAnalysisSubsectionHeading>
        ))}
      </div>
    </div>
  );
}

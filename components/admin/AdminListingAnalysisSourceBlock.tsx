"use client";

import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import {
  emptyListingAnalysisBlock,
  LISTING_ANALYSIS_COMMENT_LABEL,
  LISTING_ANALYSIS_SUBSECTIONS,
  type ListingAnalysisBlockState,
} from "@/lib/admin-source-blocks";

const ta =
  "min-h-[72px] w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

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
      : "flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm";

  const taPriority =
    "min-h-[72px] w-full rounded-md border border-emerald-200/90 bg-white/95 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/25";
  const taPriorityCompact =
    "min-h-[52px] w-full rounded-md border border-emerald-200/90 bg-white/95 px-1.5 py-1 text-[10px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/25";

  const pri = variant === "priority";
  const dense = compact && pri;

  return (
    <div className={shell}>
      {variant === "default" ? (
        <AdminSourceBlockHeader blockKey="listing_analysis" className="mb-1.5" />
      ) : null}
      <div className={dense ? "space-y-1.5" : "space-y-2"}>
        {fields.map(({ key, title }) => (
          <div key={key}>
            <p
              className={
                dense
                  ? "mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)]"
                  : "mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)]"
              }
            >
              {title}
            </p>
            <p
              className={
                dense
                  ? "mb-0.5 text-[9px] font-medium text-[var(--color-provin-muted)]"
                  : "mb-0.5 text-[10px] font-medium text-[var(--color-provin-muted)]"
              }
            >
              {LISTING_ANALYSIS_COMMENT_LABEL}
            </p>
            {readOnly ? (
              <div
                className={
                  pri
                    ? dense
                      ? "min-h-[32px] whitespace-pre-wrap rounded border border-emerald-100 bg-white/95 px-1.5 py-1 text-[10px] text-[var(--color-provin-muted)]"
                      : "min-h-[48px] whitespace-pre-wrap rounded-md border border-emerald-100 bg-white/95 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]"
                    : "min-h-[48px] whitespace-pre-wrap rounded-md border border-slate-100 bg-white/90 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]"
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
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import {
  LISTING_ANALYSIS_SUBSECTIONS,
  type ListingAnalysisBlockState,
} from "@/lib/admin-source-blocks";

const ta =
  "min-h-[72px] w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type Props = {
  value: ListingAnalysisBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: ListingAnalysisBlockState) => void;
};

export function AdminListingAnalysisSourceBlock({ value, readOnly, disabled, onChange }: Props) {
  const L = LISTING_ANALYSIS_SUBSECTIONS;
  const fields: { key: keyof ListingAnalysisBlockState; title: string }[] = [
    { key: "sellerPortrait", title: L.sellerPortrait },
    { key: "photoAnalysis", title: L.photoAnalysis },
    { key: "listingDescription", title: L.listingDescription },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-slate-50/40 p-2 shadow-sm">
      <AdminSourceBlockHeader blockKey="listing_analysis" className="mb-1.5" />
      <div className="space-y-2">
        {fields.map(({ key, title }) => (
          <div key={key}>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)]">
              {title}
            </p>
            <p className="mb-0.5 text-[10px] font-medium text-[var(--color-provin-muted)]">Komentāri</p>
            {readOnly ? (
              <div className="min-h-[48px] whitespace-pre-wrap rounded-md border border-slate-100 bg-white/90 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
                {value[key].trim() || "—"}
              </div>
            ) : (
              <textarea
                className={ta}
                disabled={disabled}
                rows={4}
                value={value[key]}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
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

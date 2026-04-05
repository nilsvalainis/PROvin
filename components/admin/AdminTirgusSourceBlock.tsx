"use client";

import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type { TirgusFormFields } from "@/lib/admin-source-blocks";
import {
  TIRGUS_LABEL_COMMENTS,
  TIRGUS_LABEL_CREATED,
  TIRGUS_LABEL_LISTED,
  TIRGUS_LABEL_PRICE_DROP,
} from "@/lib/admin-source-blocks";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type Props = {
  value: TirgusFormFields;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: TirgusFormFields) => void;
};

export function AdminTirgusSourceBlock({ value, readOnly, disabled, onChange }: Props) {
  const setField = (key: keyof TirgusFormFields, v: string) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/40 p-2 shadow-sm sm:col-span-2 lg:col-span-3">
      <AdminSourceBlockHeader blockKey="tirgus" />

      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-slate-200/60 bg-white/50 px-2 py-2">
        {readOnly ? (
          <div className="flex min-w-0 flex-1 flex-wrap gap-2 text-[11px] text-[var(--color-provin-muted)]">
            <span className="rounded bg-white/90 px-1.5 py-0.5">
              <span className="text-[10px] text-[var(--color-provin-muted)]">{TIRGUS_LABEL_LISTED}</span>{" "}
              {value.listedForSale.trim() || "—"}
            </span>
            <span className="rounded bg-white/90 px-1.5 py-0.5">
              <span className="text-[10px] text-[var(--color-provin-muted)]">{TIRGUS_LABEL_CREATED}</span>{" "}
              {value.listingCreated.trim() || "—"}
            </span>
            <span className="rounded bg-white/90 px-1.5 py-0.5">
              <span className="text-[10px] text-[var(--color-provin-muted)]">{TIRGUS_LABEL_PRICE_DROP}</span>{" "}
              {value.priceDrop.trim() || "—"}
            </span>
          </div>
        ) : (
          <>
            <div className="min-w-[6.5rem] flex-1 sm:max-w-[12rem]">
              <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
                {TIRGUS_LABEL_LISTED}
              </label>
              <input
                type="text"
                className={inp}
                placeholder='piem., "22 dienas"'
                value={value.listedForSale}
                disabled={disabled}
                onChange={(e) => setField("listedForSale", e.target.value)}
                aria-label={TIRGUS_LABEL_LISTED}
              />
            </div>
            <div className="min-w-[9rem] max-w-[11rem] flex-1">
              <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
                {TIRGUS_LABEL_CREATED}
              </label>
              <input
                type="date"
                className={inp}
                value={value.listingCreated}
                disabled={disabled}
                onChange={(e) => setField("listingCreated", e.target.value)}
                aria-label={TIRGUS_LABEL_CREATED}
              />
            </div>
            <div className="min-w-[8rem] flex-1 sm:max-w-[14rem]">
              <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
                {TIRGUS_LABEL_PRICE_DROP}
              </label>
              <input
                type="text"
                className={inp}
                placeholder='piem., "-500€"'
                value={value.priceDrop}
                disabled={disabled}
                onChange={(e) => setField("priceDrop", e.target.value)}
                aria-label={TIRGUS_LABEL_PRICE_DROP}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-3 w-full min-w-0">
        <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
          {TIRGUS_LABEL_COMMENTS}
        </label>
        {readOnly ? (
          <div className="min-h-[56px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
            {value.comments.trim() ? value.comments : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <textarea
            className="w-full min-h-[72px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
            rows={3}
            placeholder="Papildu piezīmes par tirgus situāciju…"
            value={value.comments}
            disabled={disabled}
            onChange={(e) => setField("comments", e.target.value)}
            aria-label={TIRGUS_LABEL_COMMENTS}
          />
        )}
      </div>
    </div>
  );
}

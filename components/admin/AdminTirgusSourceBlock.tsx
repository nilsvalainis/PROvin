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
  /** Ievietots „Sludinājuma analīzē” — bez atsevišķas „Tirgus dati” galvenes un ārējā kartītes. */
  variant?: "default" | "embedded";
};

export function AdminTirgusSourceBlock({ value, readOnly, disabled, onChange, variant = "default" }: Props) {
  const setField = (key: keyof TirgusFormFields, v: string) => {
    onChange({ ...value, [key]: v });
  };

  const shell =
    variant === "embedded"
      ? "flex h-full min-h-0 flex-col"
      : "flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm";

  return (
    <div className={shell}>
      {variant === "default" ? <AdminSourceBlockHeader blockKey="tirgus" className="mb-2 shrink-0" /> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200/90">
          <table className="w-full min-w-[280px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                <th className="px-2 py-1">{TIRGUS_LABEL_LISTED}</th>
                <th className="px-2 py-1">{TIRGUS_LABEL_CREATED}</th>
                <th className="px-2 py-1">{TIRGUS_LABEL_PRICE_DROP}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-2 py-1 align-top">
                  {readOnly ? (
                    <span className="text-[var(--color-provin-muted)]">{value.listedForSale.trim() || "—"}</span>
                  ) : (
                    <input
                      type="text"
                      className={inp}
                      placeholder='piem., "22 dienas"'
                      value={value.listedForSale}
                      disabled={disabled}
                      onChange={(e) => setField("listedForSale", e.target.value)}
                      aria-label={TIRGUS_LABEL_LISTED}
                    />
                  )}
                </td>
                <td className="px-2 py-1 align-top">
                  {readOnly ? (
                    <span className="text-[var(--color-provin-muted)]">{value.listingCreated.trim() || "—"}</span>
                  ) : (
                    <input
                      type="text"
                      className={inp}
                      placeholder="piem., 2024"
                      value={value.listingCreated}
                      disabled={disabled}
                      onChange={(e) => setField("listingCreated", e.target.value)}
                      aria-label={TIRGUS_LABEL_CREATED}
                    />
                  )}
                </td>
                <td className="px-2 py-1 align-top">
                  {readOnly ? (
                    <span className="text-[var(--color-provin-muted)]">{value.priceDrop.trim() || "—"}</span>
                  ) : (
                    <input
                      type="text"
                      className={inp}
                      placeholder='piem., "-500€"'
                      value={value.priceDrop}
                      disabled={disabled}
                      onChange={(e) => setField("priceDrop", e.target.value)}
                      aria-label={TIRGUS_LABEL_PRICE_DROP}
                    />
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-auto w-full min-w-0 shrink-0 pt-2">
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
            placeholder="Papildu komentāri par tirgus situāciju…"
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

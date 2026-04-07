"use client";

import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type { TirgusFormFields } from "@/lib/admin-source-blocks";
import {
  emptyTirgusFields,
  LISTING_ANALYSIS_COMMENT_LABEL,
  LISTING_HISTORY_SUBSECTION_TITLE,
  TIRGUS_LABEL_CREATED,
  TIRGUS_LABEL_LISTED,
  TIRGUS_LABEL_PRICE_DROP,
} from "@/lib/admin-source-blocks";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const taDefault =
  "min-h-[72px] w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const taEmbedded =
  "min-h-[72px] w-full rounded-md border border-emerald-200/90 bg-white/95 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/25";

type Props = {
  value?: TirgusFormFields | null;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: TirgusFormFields) => void;
  /** Ievietots „Sludinājuma analīzē” — bez atsevišķas „Tirgus dati” galvenes un ārējā kartītes. */
  variant?: "default" | "embedded";
};

export function AdminTirgusSourceBlock({ value, readOnly, disabled, onChange, variant = "default" }: Props) {
  const val = value ?? emptyTirgusFields();
  const setField = (key: keyof TirgusFormFields, v: string) => {
    onChange({ ...val, [key]: v });
  };

  const shell =
    variant === "embedded"
      ? "w-full min-w-0 flex flex-col"
      : "flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm";

  const tableBlock = (
    <div className="min-h-0 w-full overflow-x-auto rounded-lg border border-slate-200/90">
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
                <span className="text-[var(--color-provin-muted)]">{val.listedForSale.trim() || "—"}</span>
              ) : (
                <input
                  type="text"
                  className={inp}
                  placeholder='piem., "22 dienas"'
                  value={val.listedForSale}
                  disabled={disabled}
                  onChange={(e) => setField("listedForSale", e.target.value)}
                  aria-label={TIRGUS_LABEL_LISTED}
                />
              )}
            </td>
            <td className="px-2 py-1 align-top">
              {readOnly ? (
                <span className="text-[var(--color-provin-muted)]">{val.listingCreated.trim() || "—"}</span>
              ) : (
                <input
                  type="text"
                  className={inp}
                  placeholder="piem., 2024"
                  value={val.listingCreated}
                  disabled={disabled}
                  onChange={(e) => setField("listingCreated", e.target.value)}
                  aria-label={TIRGUS_LABEL_CREATED}
                />
              )}
            </td>
            <td className="px-2 py-1 align-top">
              {readOnly ? (
                <span className="text-[var(--color-provin-muted)]">{val.priceDrop.trim() || "—"}</span>
              ) : (
                <input
                  type="text"
                  className={inp}
                  placeholder='piem., "-500€"'
                  value={val.priceDrop}
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
  );

  const commentsReadonlyClassEmbedded =
    "min-h-[48px] whitespace-pre-wrap rounded-md border border-emerald-100 bg-white/95 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]";
  const commentsReadonlyClassDefault =
    "min-h-[48px] whitespace-pre-wrap rounded-md border border-slate-100 bg-white/90 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]";

  const commentsBlock =
    variant === "embedded" ? (
      <div>
        <p className="mb-0.5 text-[10px] font-medium text-[var(--color-provin-muted)]">{LISTING_ANALYSIS_COMMENT_LABEL}</p>
        {readOnly ? (
          <div className={commentsReadonlyClassEmbedded}>
            {val.comments.trim() ? val.comments : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <textarea
            className={taEmbedded}
            rows={4}
            placeholder=""
            value={val.comments}
            disabled={disabled}
            onChange={(e) => setField("comments", e.target.value)}
            aria-label={`${LISTING_HISTORY_SUBSECTION_TITLE} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
          />
        )}
      </div>
    ) : (
      <div className="mt-auto w-full min-w-0 shrink-0 pt-2">
        <p className="mb-0.5 text-[10px] font-medium text-[var(--color-provin-muted)]">{LISTING_ANALYSIS_COMMENT_LABEL}</p>
        {readOnly ? (
          <div className={commentsReadonlyClassDefault}>
            {val.comments.trim() ? val.comments : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <textarea
            className={taDefault}
            rows={4}
            placeholder="Papildu komentāri par sludinājuma vēsturi…"
            value={val.comments}
            disabled={disabled}
            onChange={(e) => setField("comments", e.target.value)}
            aria-label={`Tirgus — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
          />
        )}
      </div>
    );

  if (variant === "embedded") {
    return (
      <div className={shell}>
        <div className="space-y-2">
          {tableBlock}
          {commentsBlock}
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <AdminSourceBlockHeader blockKey="tirgus" className="mb-2 shrink-0" />
      <div className="min-h-0 flex-1 overflow-y-auto">{tableBlock}</div>
      {commentsBlock}
    </div>
  );
}

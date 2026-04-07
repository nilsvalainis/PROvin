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

const taEmbeddedCompact =
  "min-h-[48px] w-full rounded-md border border-emerald-200/90 bg-white/95 px-1.5 py-1 text-[10px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/25";

type Props = {
  value?: TirgusFormFields | null;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: TirgusFormFields) => void;
  /** Ievietots „Sludinājuma analīzē” — bez atsevišķas „Tirgus dati” galvenes un ārējā kartītes. */
  variant?: "default" | "embedded";
  /** Zemāks augstums (admin kompaktais skats). */
  compact?: boolean;
};

export function AdminTirgusSourceBlock({ value, readOnly, disabled, onChange, variant = "default", compact = false }: Props) {
  const val = value ?? emptyTirgusFields();
  const setField = (key: keyof TirgusFormFields, v: string) => {
    onChange({ ...val, [key]: v });
  };

  const shell =
    variant === "embedded"
      ? "w-full min-w-0 flex flex-col"
      : "flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm";

  const embDense = variant === "embedded" && compact;
  const cellPad = embDense ? "px-1.5 py-0.5" : "px-2 py-1";

  const tableBlock = (
    <div className="min-h-0 w-full overflow-x-auto rounded-lg border border-slate-200/90">
      <table className={`w-full min-w-[280px] border-collapse ${embDense ? "text-[10px]" : "text-[11px]"}`}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
            <th className={cellPad}>{TIRGUS_LABEL_LISTED}</th>
            <th className={cellPad}>{TIRGUS_LABEL_CREATED}</th>
            <th className={cellPad}>{TIRGUS_LABEL_PRICE_DROP}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className={`${cellPad} align-top`}>
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
            <td className={`${cellPad} align-top`}>
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
            <td className={`${cellPad} align-top`}>
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

  const commentsReadonlyClassEmbedded = embDense
    ? "min-h-[32px] whitespace-pre-wrap rounded border border-emerald-100 bg-white/95 px-1.5 py-1 text-[10px] text-[var(--color-provin-muted)]"
    : "min-h-[48px] whitespace-pre-wrap rounded-md border border-emerald-100 bg-white/95 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]";
  const commentsReadonlyClassDefault =
    "min-h-[48px] whitespace-pre-wrap rounded-md border border-slate-100 bg-white/90 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]";

  const commentsBlock =
    variant === "embedded" ? (
      <div>
        <p
          className={
            embDense
              ? "mb-0.5 text-[9px] font-medium text-[var(--color-provin-muted)]"
              : "mb-0.5 text-[10px] font-medium text-[var(--color-provin-muted)]"
          }
        >
          {LISTING_ANALYSIS_COMMENT_LABEL}
        </p>
        {readOnly ? (
          <div className={commentsReadonlyClassEmbedded}>
            {val.comments.trim() ? val.comments : <span className="text-slate-400">—</span>}
          </div>
        ) : (
          <textarea
            className={embDense ? taEmbeddedCompact : taEmbedded}
            rows={embDense ? 2 : 4}
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
        <div className={embDense ? "space-y-1.5" : "space-y-2"}>
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

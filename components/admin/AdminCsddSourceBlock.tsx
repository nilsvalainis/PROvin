"use client";

import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type { CsddFormFields, CsddMileageHistoryRow } from "@/lib/admin-source-blocks";
import {
  CSDD_FORM_SHORT_FIELDS,
  CSDD_LABEL_COMMENTS,
  CSDD_LABEL_PREV_RATING,
  CSDD_MILEAGE_HISTORY_TITLE,
  emptyCsddMileageRow,
} from "@/lib/admin-source-blocks";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const dateKeys = new Set<keyof CsddFormFields>(["firstRegDate", "nextInspectionDate", "prevInspectionDate"]);

type Props = {
  value: CsddFormFields;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: CsddFormFields) => void;
};

export function AdminCsddSourceBlock({ value, readOnly, disabled, onChange }: Props) {
  const setField = (key: keyof CsddFormFields, v: string) => {
    onChange({ ...value, [key]: v });
  };

  const handleRawInput = (raw: string) => {
    const parsed = parseCsddPaste(raw);
    onChange(applyCsddPasteToForm(value, raw, parsed));
  };

  const mileageRows =
    value.mileageHistoryLv.length > 0 ? value.mileageHistoryLv : [emptyCsddMileageRow()];

  const setMileage = (index: number, patch: Partial<CsddMileageHistoryRow>) => {
    const base = value.mileageHistoryLv.length > 0 ? [...value.mileageHistoryLv] : [emptyCsddMileageRow()];
    const row = base[index] ?? emptyCsddMileageRow();
    base[index] = { ...row, ...patch };
    onChange({ ...value, mileageHistoryLv: base });
  };

  const addMileageRow = () => {
    const base =
      value.mileageHistoryLv.length > 0 ? value.mileageHistoryLv : [emptyCsddMileageRow()];
    onChange({
      ...value,
      mileageHistoryLv: [...base, emptyCsddMileageRow()],
    });
  };

  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm">
      <AdminSourceBlockHeader blockKey="csdd" />

      <div className="mb-2 min-w-0">
        <label
          className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]"
          htmlFor="csdd_raw_data"
        >
          CSDD Neapstrādātie dati (Paste here)
        </label>
        {readOnly ? (
          <div className="min-h-[72px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-slate-100 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
            {value.rawUnprocessedData.trim() ? (
              value.rawUnprocessedData
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>
        ) : (
          <textarea
            id="csdd_raw_data"
            className="w-full min-h-[96px] resize-y rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
            rows={5}
            value={value.rawUnprocessedData}
            disabled={disabled}
            placeholder="Ielīmē šeit visu tekstu no CSDD…"
            onChange={(e) => handleRawInput(e.target.value)}
            aria-label="CSDD neapstrādātie dati"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CSDD_FORM_SHORT_FIELDS.map(({ key, label }) => {
          const strVal = value[key] as string;
          return (
            <div key={key} className="min-w-0">
              <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">{label}</label>
              {readOnly ? (
                <div className="min-h-[28px] whitespace-pre-wrap rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] text-[var(--color-provin-muted)]">
                  {strVal.trim() ? strVal : <span className="text-slate-400">—</span>}
                </div>
              ) : dateKeys.has(key) ? (
                <input
                  type="date"
                  className={inp}
                  value={strVal}
                  disabled={disabled}
                  onChange={(e) => setField(key, e.target.value)}
                  aria-label={label}
                />
              ) : key === "solidParticlesCm3" ? (
                <input
                  type="text"
                  inputMode="decimal"
                  className={inp}
                  value={strVal}
                  disabled={disabled}
                  onChange={(e) => setField(key, e.target.value)}
                  aria-label={label}
                />
              ) : (
                <input
                  type="text"
                  className={inp}
                  value={strVal}
                  disabled={disabled}
                  onChange={(e) => setField(key, e.target.value)}
                  aria-label={label}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 space-y-2">
        <div className="min-w-0 w-full">
          <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
            {CSDD_LABEL_PREV_RATING}
          </label>
          {readOnly ? (
            <div className="min-h-[72px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
              {value.prevInspectionRating.trim() ? (
                value.prevInspectionRating
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>
          ) : (
            <textarea
              className="w-full min-h-[88px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
              rows={4}
              value={value.prevInspectionRating}
              disabled={disabled}
              onChange={(e) => setField("prevInspectionRating", e.target.value)}
              aria-label={CSDD_LABEL_PREV_RATING}
            />
          )}
        </div>

        <div className="min-w-0 w-full">
          <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
            {CSDD_LABEL_COMMENTS}
          </label>
          {readOnly ? (
            <div className="min-h-[56px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
              {value.comments.trim() ? value.comments : <span className="text-slate-400">—</span>}
            </div>
          ) : (
            <textarea
              className="w-full min-h-[72px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20"
              rows={4}
              value={value.comments}
              disabled={disabled}
              onChange={(e) => setField("comments", e.target.value)}
              aria-label={CSDD_LABEL_COMMENTS}
            />
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-slate-200/80 pt-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
          {CSDD_MILEAGE_HISTORY_TITLE}
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200/90">
          <table className="w-full min-w-[280px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                <th className="px-2 py-1">Datums</th>
                <th className="px-2 py-1">Odometrs</th>
                <th className="px-2 py-1">Nobraukums</th>
              </tr>
            </thead>
            <tbody>
              {mileageRows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-1 align-top">
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{row.date.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={row.date}
                        disabled={disabled}
                        onChange={(e) => setMileage(i, { date: e.target.value })}
                        aria-label={`Nobraukuma vēsture datums rinda ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1 align-top">
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{row.odometer.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        className={inp}
                        value={row.odometer}
                        disabled={disabled}
                        onChange={(e) => setMileage(i, { odometer: e.target.value })}
                        aria-label={`Odometrs rinda ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1 align-top">
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{row.distance.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        className={inp}
                        value={row.distance}
                        disabled={disabled}
                        onChange={(e) => setMileage(i, { distance: e.target.value })}
                        aria-label={`Nobraukums rinda ${i + 1}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && !disabled && (
          <button
            type="button"
            className="mt-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
            onClick={addMileageRow}
          >
            + Rinda
          </button>
        )}
      </div>
    </div>
  );
}

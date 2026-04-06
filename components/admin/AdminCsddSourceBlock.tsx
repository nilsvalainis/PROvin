"use client";

import { useState } from "react";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import type {
  CsddDefectRow,
  CsddFormFields,
  CsddMileageAbroadRow,
  CsddMileageHistoryRow,
} from "@/lib/admin-source-blocks";
import {
  CSDD_DEFECT_COL_CODE,
  CSDD_DEFECT_COL_DEFECTS,
  CSDD_DEFECT_COL_RATING,
  CSDD_FORM_SHORT_FIELDS,
  CSDD_LABEL_COMMENTS,
  CSDD_LABEL_DETAILED_RATING,
  CSDD_LABEL_PREV_INSPECTION_DATA,
  CSDD_MILEAGE_ABROAD_TITLE,
  CSDD_MILEAGE_COL_SOURCE,
  CSDD_MILEAGE_HISTORY_TITLE,
  CSDD_MILEAGE_VISIBLE_LIMIT,
  csddMileageAbroadRowHasData,
  csddMileageRowHasData,
  emptyCsddDefectRow,
  emptyCsddMileageAbroadRow,
  emptyCsddMileageRow,
} from "@/lib/admin-source-blocks";
import { takeNewestMileageRowsForDisplay } from "@/lib/csdd-mileage-display";
import { defectRowHasData } from "@/lib/csdd-defect-parse";
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
  const [showAllLv, setShowAllLv] = useState(false);
  const [showAllAbroad, setShowAllAbroad] = useState(false);

  const setField = (key: keyof CsddFormFields, v: string) => {
    onChange({ ...value, [key]: v });
  };

  const handleRawInput = (raw: string) => {
    const parsed = parseCsddPaste(raw);
    onChange(applyCsddPasteToForm(value, raw, parsed));
  };

  const lvFull =
    value.mileageHistoryLv.length > 0 ? value.mileageHistoryLv : [emptyCsddMileageRow()];
  const lvVisible = takeNewestMileageRowsForDisplay(lvFull, csddMileageRowHasData, showAllLv);
  const lvDataCount = lvFull.filter(csddMileageRowHasData).length;
  const lvCompact = lvDataCount > CSDD_MILEAGE_VISIBLE_LIMIT;

  const abroadFull =
    value.mileageHistoryAbroad.length > 0
      ? value.mileageHistoryAbroad
      : [emptyCsddMileageAbroadRow()];
  const abroadVisible = takeNewestMileageRowsForDisplay(
    abroadFull,
    csddMileageAbroadRowHasData,
    showAllAbroad,
  );
  const abroadDataCount = abroadFull.filter(csddMileageAbroadRowHasData).length;
  const abroadCompact = abroadDataCount > CSDD_MILEAGE_VISIBLE_LIMIT;

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

  const setAbroad = (index: number, patch: Partial<CsddMileageAbroadRow>) => {
    const base =
      value.mileageHistoryAbroad.length > 0 ? [...value.mileageHistoryAbroad] : [emptyCsddMileageAbroadRow()];
    const row = base[index] ?? emptyCsddMileageAbroadRow();
    base[index] = { ...row, ...patch };
    onChange({ ...value, mileageHistoryAbroad: base });
  };

  const addAbroadRow = () => {
    const base =
      value.mileageHistoryAbroad.length > 0 ? value.mileageHistoryAbroad : [emptyCsddMileageAbroadRow()];
    onChange({
      ...value,
      mileageHistoryAbroad: [...base, emptyCsddMileageAbroadRow()],
    });
  };

  const detailedRows =
    value.detailedRatingRows.length > 0 ? value.detailedRatingRows : [emptyCsddDefectRow()];
  const histRows =
    value.prevInspectionDefectRows.length > 0 ? value.prevInspectionDefectRows : [emptyCsddDefectRow()];

  const setDetailedDefect = (index: number, patch: Partial<CsddDefectRow>) => {
    const base =
      value.detailedRatingRows.length > 0 ? [...value.detailedRatingRows] : [emptyCsddDefectRow()];
    const row = base[index] ?? emptyCsddDefectRow();
    base[index] = { ...row, ...patch };
    onChange({ ...value, detailedRatingRows: base, prevInspectionRating: "" });
  };

  const setHistDefect = (index: number, patch: Partial<CsddDefectRow>) => {
    const base =
      value.prevInspectionDefectRows.length > 0 ? [...value.prevInspectionDefectRows] : [emptyCsddDefectRow()];
    const row = base[index] ?? emptyCsddDefectRow();
    base[index] = { ...row, ...patch };
    onChange({ ...value, prevInspectionDefectRows: base });
  };

  const addDetailedRow = () => {
    const base =
      value.detailedRatingRows.length > 0 ? value.detailedRatingRows : [emptyCsddDefectRow()];
    onChange({
      ...value,
      detailedRatingRows: [...base, emptyCsddDefectRow()],
      prevInspectionRating: "",
    });
  };

  const addHistRow = () => {
    const base =
      value.prevInspectionDefectRows.length > 0 ? value.prevInspectionDefectRows : [emptyCsddDefectRow()];
    onChange({ ...value, prevInspectionDefectRows: [...base, emptyCsddDefectRow()] });
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

      <div className="mt-2 space-y-3">
        <div className="min-w-0 w-full">
          <label className="mb-0.5 block text-[10px] font-medium text-[var(--color-provin-muted)]">
            {CSDD_LABEL_DETAILED_RATING}
          </label>
          {readOnly && !value.detailedRatingRows.some(defectRowHasData) && value.prevInspectionRating.trim() ? (
            <div className="min-h-[56px] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]">
              {value.prevInspectionRating}
            </div>
          ) : readOnly && !value.detailedRatingRows.some(defectRowHasData) && !value.prevInspectionRating.trim() ? (
            <div className="text-[11px] text-slate-400">—</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200/90">
              <table className="w-full min-w-[320px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                    <th className="w-[14%] px-1.5 py-1">{CSDD_DEFECT_COL_CODE}</th>
                    <th className="w-[22%] px-1.5 py-1">{CSDD_DEFECT_COL_RATING}</th>
                    <th className="px-1.5 py-1">{CSDD_DEFECT_COL_DEFECTS}</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedRows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 align-top last:border-b-0">
                      <td className="px-1.5 py-0.5">
                        {readOnly ? (
                          <span className="text-[var(--color-provin-muted)]">{row.code.trim() || "—"}</span>
                        ) : (
                          <input
                            type="text"
                            className={inp}
                            value={row.code}
                            disabled={disabled}
                            onChange={(e) => setDetailedDefect(i, { code: e.target.value })}
                            aria-label={`${CSDD_DEFECT_COL_CODE} ${i + 1}`}
                          />
                        )}
                      </td>
                      <td className="px-1.5 py-0.5">
                        {readOnly ? (
                          <span className="text-[var(--color-provin-muted)]">{row.rating.trim() || "—"}</span>
                        ) : (
                          <input
                            type="text"
                            className={inp}
                            value={row.rating}
                            disabled={disabled}
                            onChange={(e) => setDetailedDefect(i, { rating: e.target.value })}
                            aria-label={`${CSDD_DEFECT_COL_RATING} ${i + 1}`}
                          />
                        )}
                      </td>
                      <td className="px-1.5 py-0.5">
                        {readOnly ? (
                          <span className="whitespace-pre-wrap text-[var(--color-provin-muted)]">
                            {row.defects.trim() || "—"}
                          </span>
                        ) : (
                          <textarea
                            className="min-h-[40px] w-full resize-y rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] leading-snug text-[var(--color-apple-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/20"
                            rows={2}
                            value={row.defects}
                            disabled={disabled}
                            onChange={(e) => setDetailedDefect(i, { defects: e.target.value })}
                            aria-label={`${CSDD_DEFECT_COL_DEFECTS} ${i + 1}`}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!readOnly && !disabled && (
            <button
              type="button"
              className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
              onClick={addDetailedRow}
            >
              + Rinda
            </button>
          )}
        </div>

        <div className="min-w-0 w-full">
          <label className="mb-0.5 block text-[10px] font-medium text-slate-500">
            {CSDD_LABEL_PREV_INSPECTION_DATA}
          </label>
          {readOnly && !value.prevInspectionDefectRows.some(defectRowHasData) ? (
            <div className="text-[10px] text-slate-400">—</div>
          ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-slate-50/40">
            <table className="w-full min-w-[320px] border-collapse text-[10px] text-slate-600">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-left font-medium text-slate-500">
                  <th className="w-[14%] px-1.5 py-0.5">{CSDD_DEFECT_COL_CODE}</th>
                  <th className="w-[22%] px-1.5 py-0.5">{CSDD_DEFECT_COL_RATING}</th>
                  <th className="px-1.5 py-0.5">{CSDD_DEFECT_COL_DEFECTS}</th>
                </tr>
              </thead>
              <tbody>
                {histRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="px-1.5 py-0.5">
                      {readOnly ? (
                        <span>{row.code.trim() || "—"}</span>
                      ) : (
                        <input
                          type="text"
                          className={`${inp} text-[10px]`}
                          value={row.code}
                          disabled={disabled}
                          onChange={(e) => setHistDefect(i, { code: e.target.value })}
                          aria-label={`Vēsturiskais ${CSDD_DEFECT_COL_CODE} ${i + 1}`}
                        />
                      )}
                    </td>
                    <td className="px-1.5 py-0.5">
                      {readOnly ? (
                        <span>{row.rating.trim() || "—"}</span>
                      ) : (
                        <input
                          type="text"
                          className={`${inp} text-[10px]`}
                          value={row.rating}
                          disabled={disabled}
                          onChange={(e) => setHistDefect(i, { rating: e.target.value })}
                          aria-label={`Vēsturiskais ${CSDD_DEFECT_COL_RATING} ${i + 1}`}
                        />
                      )}
                    </td>
                    <td className="px-1.5 py-0.5">
                      {readOnly ? (
                        <span className="whitespace-pre-wrap">{row.defects.trim() || "—"}</span>
                      ) : (
                        <textarea
                          className="min-h-[36px] w-full resize-y rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] leading-snug text-slate-700 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/20"
                          rows={2}
                          value={row.defects}
                          disabled={disabled}
                          onChange={(e) => setHistDefect(i, { defects: e.target.value })}
                          aria-label={`Vēsturiskais ${CSDD_DEFECT_COL_DEFECTS} ${i + 1}`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          {!readOnly && !disabled && (
            <button
              type="button"
              className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50"
              onClick={addHistRow}
            >
              + Rinda
            </button>
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
              {lvVisible.map(({ r: row, index: i }) => (
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
        {lvCompact && (
          <button
            type="button"
            className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
            onClick={() => setShowAllLv((v) => !v)}
          >
            {showAllLv ? "Rādīt mazāk" : "Rādīt visu"}
          </button>
        )}
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

      <div className="mt-3 border-t border-slate-200/80 pt-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
          {CSDD_MILEAGE_ABROAD_TITLE}
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200/90">
          <table className="w-full min-w-[280px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                <th className="px-2 py-1">Datums</th>
                <th className="px-2 py-1">Odometrs</th>
                <th className="px-2 py-1">{CSDD_MILEAGE_COL_SOURCE}</th>
              </tr>
            </thead>
            <tbody>
              {abroadVisible.map(({ r: row, index: i }) => (
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
                        onChange={(e) => setAbroad(i, { date: e.target.value })}
                        aria-label={`Nobraukums ārvalstīs datums rinda ${i + 1}`}
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
                        onChange={(e) => setAbroad(i, { odometer: e.target.value })}
                        aria-label={`Nobraukums ārvalstīs odometrs rinda ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1 align-top">
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{row.source.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={row.source}
                        disabled={disabled}
                        onChange={(e) => setAbroad(i, { source: e.target.value })}
                        aria-label={`${CSDD_MILEAGE_COL_SOURCE} rinda ${i + 1}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {abroadCompact && (
          <button
            type="button"
            className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
            onClick={() => setShowAllAbroad((v) => !v)}
          >
            {showAllAbroad ? "Rādīt mazāk" : "Rādīt visu"}
          </button>
        )}
        {!readOnly && !disabled && (
          <button
            type="button"
            className="mt-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
            onClick={addAbroadRow}
          >
            + Rinda
          </button>
        )}
      </div>
    </div>
  );
}

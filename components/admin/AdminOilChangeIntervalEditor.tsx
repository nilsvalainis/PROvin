"use client";

import { useMemo } from "react";
import { oilChangeIntervalAdminPreviewCss } from "@/lib/oil-change-interval-pdf-styles";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import { dropOrResetRow } from "@/lib/admin-drop-or-reset-row";
import { buildOilChangeIntervalPdfHtml } from "@/lib/oil-change-intervals";
import {
  buildOilIntervalSeriesForBlock,
  emptyOilIntervalChart,
  emptyOilIntervalChartRow,
  resolveOilIntervalChartRows,
  type OilIntervalChartRow,
  type OilIntervalChartState,
} from "@/lib/oil-change-interval-chart";
import { AdminPdfIncludeToggle } from "@/components/admin/AdminPdfIncludeToggle";
import {
  AdminSourceCommentField,
  type AdminAiSourceCommentSlot,
} from "@/components/admin/AdminSourceCommentField";

type Props = {
  value: AutoRecordsBlockState;
  onChange: (next: AutoRecordsBlockState) => void;
  readOnly?: boolean;
  disabled?: boolean;
  pdfIncludeOil?: boolean;
  onPdfIncludeOilChange?: (next: boolean) => void;
  aiOilChangeInterval?: AdminAiSourceCommentSlot;
  dealerAria: string;
};

function parseKmDigits(raw: string): number | null {
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

function formatKmInput(n: number | null): string {
  if (n == null) return "";
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function ensureChart(block: AutoRecordsBlockState): OilIntervalChartState {
  return block.oilIntervalChart ?? emptyOilIntervalChart();
}

function patchChart(
  block: AutoRecordsBlockState,
  patch: Partial<OilIntervalChartState>,
): AutoRecordsBlockState {
  const base = ensureChart(block);
  const next: OilIntervalChartState = { ...base, ...patch, useSavedRows: true };
  return { ...block, oilIntervalChart: next };
}

export function AdminOilChangeIntervalEditor({
  value,
  onChange,
  readOnly,
  disabled,
  pdfIncludeOil = true,
  onPdfIncludeOilChange,
  aiOilChangeInterval,
  dealerAria,
}: Props) {
  const locked = readOnly || disabled;
  const displayRows = useMemo(() => resolveOilIntervalChartRows(value), [value]);
  const series = useMemo(() => buildOilIntervalSeriesForBlock(value), [value]);
  const previewHtml = useMemo(() => {
    if (series.points.length === 0) return "";
    return buildOilChangeIntervalPdfHtml(series);
  }, [series]);

  const updateRows = (rows: OilIntervalChartRow[]) => {
    onChange(patchChart(value, { rows }));
  };

  const setRow = (index: number, patch: Partial<OilIntervalChartRow>) => {
    const rows = [...displayRows];
    rows[index] = { ...rows[index], ...patch };
    updateRows(rows);
  };

  const moveRow = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= displayRows.length) return;
    const rows = [...displayRows];
    const tmp = rows[index]!;
    rows[index] = rows[j]!;
    rows[j] = tmp;
    updateRows(rows);
  };

  const addRow = () => {
    updateRows([...displayRows, emptyOilIntervalChartRow()]);
  };

  const removeRow = (index: number) => {
    const rows = dropOrResetRow(displayRows, index, emptyOilIntervalChartRow);
    updateRows(rows);
  };

  const chart = ensureChart(value);
  const oemKmStr = formatKmInput(chart.oemKm);
  const oemMonthsStr = chart.oemMonths != null ? String(chart.oemMonths) : "";

  return (
    <div className="mb-2 min-w-0 rounded-lg border border-slate-200/90 bg-white p-2.5">
      <style dangerouslySetInnerHTML={{ __html: oilChangeIntervalAdminPreviewCss() }} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[#1d1d1f]">Eļļas maiņas intervāli</p>
        {onPdfIncludeOilChange ? (
          <AdminPdfIncludeToggle
            id="auto-records-oil-pdf"
            checked={pdfIncludeOil}
            onChange={onPdfIncludeOilChange}
            label="Rādīt PDF"
          />
        ) : null}
      </div>

      <div className="grid min-w-0 gap-2 xl:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Ražotāja intervāls (norma)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block min-w-0">
                <span className="mb-0.5 block text-[9px] font-medium text-slate-500">Kilometri</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]"
                  value={oemKmStr}
                  disabled={locked}
                  onChange={(e) => {
                    const km = parseKmDigits(e.target.value);
                    onChange(patchChart(value, { oemKm: km }));
                  }}
                  aria-label="Ražotāja intervāls kilometros"
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-0.5 block text-[9px] font-medium text-slate-500">Mēneši</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]"
                  value={oemMonthsStr}
                  disabled={locked}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "");
                    const months = d ? Number(d) : null;
                    onChange(
                      patchChart(value, {
                        oemMonths: months != null && Number.isFinite(months) ? months : null,
                      }),
                    );
                  }}
                  aria-label="Ražotāja intervāls mēnešos"
                />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Eļļas maiņas
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200/80">
              <table className="w-full min-w-[420px] border-collapse text-[11px]">
                <thead>
                  <tr className="text-left text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-1.5 py-1">Datums</th>
                    <th className="px-1.5 py-1">km</th>
                    <th className="px-1.5 py-1">Intervāls</th>
                    <th className="px-1.5 py-1">Periods</th>
                    <th className="w-16 px-1 py-1" aria-label="Kārtot un dzēst" />
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, i) => {
                    const pt = series.points[i];
                    const intervalLabel =
                      pt?.kind === "start"
                        ? "Sākums"
                        : pt?.intervalKm != null
                          ? `${String(pt.intervalKm).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`
                          : "";
                    const periodLabel =
                      pt?.intervalMonths != null ? `${pt.intervalMonths} mēn.` : "";
                    return (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-1 py-0.5 align-top">
                          <input
                            className="w-full min-w-[72px] rounded border border-slate-200 px-1.5 py-0.5 text-[11px]"
                            value={row.date}
                            disabled={locked}
                            onChange={(e) => setRow(i, { date: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-top">
                          <input
                            className="w-full min-w-[64px] rounded border border-slate-200 px-1.5 py-0.5 text-[11px]"
                            value={row.odometer}
                            disabled={locked}
                            onChange={(e) => setRow(i, { odometer: e.target.value })}
                          />
                        </td>
                        <td className="px-1.5 py-1 align-top text-[10px] text-slate-600 whitespace-nowrap">
                          {intervalLabel}
                          {pt?.kind === "gap" ? (
                            <span className="mt-0.5 block text-[8px] font-semibold uppercase text-slate-400">
                              Datu iztrūkums
                            </span>
                          ) : null}
                        </td>
                        <td className="px-1.5 py-1 align-top text-[10px] text-slate-600 whitespace-nowrap">
                          {periodLabel}
                        </td>
                        <td className="px-0.5 py-0.5 align-top">
                          {!locked ? (
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                onClick={() => moveRow(i, -1)}
                                aria-label="Augšup"
                              >
                                <ChevronUp className="size-3.5" strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                onClick={() => moveRow(i, 1)}
                                aria-label="Lejup"
                              >
                                <ChevronDown className="size-3.5" strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                onClick={() => removeRow(i)}
                                aria-label="Dzēst rindu"
                              >
                                <Trash2 className="size-3.5" strokeWidth={2} />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!locked ? (
              <button
                type="button"
                className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
                onClick={addRow}
              >
                + Pievienot maiņu
              </button>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[10px] text-slate-600">
            <input
              type="checkbox"
              className="size-3.5 rounded border-slate-300 accent-[var(--color-provin-accent)]"
              checked={chart.highlightOverOem}
              disabled={locked}
              onChange={(e) => onChange(patchChart(value, { highlightOverOem: e.target.checked }))}
            />
            Krāsot intervālus virs OEM (sarkans)
          </label>

          <AdminSourceCommentField
            label="Papildu komentārs PDF"
            value={value.oilChangeIntervalNotes ?? ""}
            onChange={(next) => onChange({ ...value, oilChangeIntervalNotes: next })}
            readOnly={readOnly}
            disabled={disabled}
            compact
            ai={aiOilChangeInterval}
            readonlyClassName="min-h-[36px] rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]"
            aria-label={`${dealerAria} - papildu komentārs eļļas intervāliem`}
          />
        </div>

        <div className="min-w-0">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            PDF priekšskatījums
          </p>
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-2">
            {previewHtml ? (
              <div
                className="admin-oil-preview min-w-0"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <p className="text-[10px] text-slate-500">
                Pievieno eļļas maiņu rindas vai aizpildi servisa tabulu, lai redzētu grafiku.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

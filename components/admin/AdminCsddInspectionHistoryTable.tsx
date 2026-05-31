"use client";

import {
  groupTechnicalInspectionsByYear,
  isoDateToLvDisplay,
  previousInspectionBlockToRow,
  type CsddInspectionDefectRow,
  type CsddPreviousInspectionBlock,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";

const mileCell = "px-1.5 py-0.5";

function ratingClass(rating: string): string {
  if (rating === "1") return "font-semibold text-emerald-700";
  if (rating === "2") return "font-semibold text-amber-700";
  if (rating === "3") return "font-semibold text-red-700";
  return "text-[var(--color-provin-muted)]";
}

function inspectionYearFromDate(date: string): number | null {
  const m = date.trim().match(/\d{2}\.\d{2}\.(\d{4})/);
  if (!m?.[1]) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

function DefectTable({ defects }: { defects: CsddInspectionDefectRow[] }) {
  const novCell = "whitespace-nowrap px-1 py-0.5 text-left";
  return (
    <table className="w-full table-fixed border-collapse text-[11px]">
      <colgroup>
        <col className="w-[1px]" />
        <col />
      </colgroup>
      <thead>
        <tr className="border-b border-slate-200 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
          <th className={novCell}>Nov.</th>
          <th className={`${mileCell} text-left`}>Trūkumi vai bojājumi</th>
        </tr>
      </thead>
      <tbody>
        {defects.length > 0 ? (
          defects.map((d, i) => (
            <tr key={`${d.code}-${i}`} className="border-b border-slate-100 last:border-b-0">
              <td className={`${novCell} align-top tabular-nums ${ratingClass(d.rating)}`}>
                {d.rating || "—"}
              </td>
              <td className={`${mileCell} align-top leading-snug text-[var(--color-apple-text)]`}>
                {d.description || "—"}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={2} className={`${mileCell} text-[var(--color-provin-muted)]`}>
              Nav reģistrētu trūkumu vai bojājumi.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function CsddInspectionBlock({
  row,
  historic,
  odometer,
  nextInspectionDateText,
}: {
  row: CsddTechnicalInspectionRow;
  historic?: boolean;
  odometer?: string;
  nextInspectionDateText?: string;
}) {
  const metaParts = [row.date, row.inspectionType];
  if (odometer?.trim()) metaParts.push(`${odometer.trim()} km`);
  if (row.ratingLabel) metaParts.push(`Novērtējums ${row.ratingLabel}`);
  const meta = metaParts.filter(Boolean).join(" · ");

  return (
    <div className={historic ? "opacity-90" : ""}>
      <p className="border-b border-slate-100 px-1.5 py-1 text-[10px] font-medium leading-snug text-[var(--color-apple-text)]">
        {meta}
      </p>
      {nextInspectionDateText?.trim() ? (
        <p className="px-1.5 py-0.5 text-[10px] text-[var(--color-provin-muted)]">
          <span className="text-[var(--color-apple-text)]">Nākamās apskates datums:</span>{" "}
          {nextInspectionDateText.trim()}
        </p>
      ) : null}
      {row.smokeCoefficient?.trim() ? (
        <p className="px-1.5 py-0.5 text-[10px] text-[var(--color-provin-muted)]">
          <span className="text-[var(--color-apple-text)]">Dūmainības koeficients (m⁻¹):</span>{" "}
          {row.smokeCoefficient.trim()}
        </p>
      ) : null}
      <DefectTable defects={row.defects ?? []} />
    </div>
  );
}

type Props = {
  rows: CsddTechnicalInspectionRow[];
};

export function AdminCsddInspectionHistoryTable({ rows }: Props) {
  const data = rows.filter((r) => r.date.trim());
  if (data.length === 0) return null;

  const byYear = groupTechnicalInspectionsByYear(data);
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const newestDate = data[0]?.date ?? "";

  return (
    <div className="space-y-3">
      {years.map((year) => (
        <div key={year}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{year}</p>
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {(byYear.get(year) ?? []).map((row, i, arr) => (
              <div
                key={row.date + row.inspectionType}
                className={i < arr.length - 1 ? "mb-2 border-b border-slate-100 pb-2" : ""}
              >
                <CsddInspectionBlock row={row} historic={row.date !== newestDate} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type PreviousProps = {
  block: CsddPreviousInspectionBlock;
  prevInspectionDateIso: string;
};

export function AdminCsddPreviousInspectionBlock({ block, prevInspectionDateIso }: PreviousProps) {
  const dateDisplay =
    block.inspectionDateText.trim() ||
    (prevInspectionDateIso.trim() ? isoDateToLvDisplay(prevInspectionDateIso) : "");
  const row = previousInspectionBlockToRow(block, dateDisplay);
  const year = inspectionYearFromDate(dateDisplay);

  return (
    <div>
      {year != null ? (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{year}</p>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CsddInspectionBlock
          row={row}
          odometer={block.odometer}
          nextInspectionDateText={block.nextInspectionDateText}
        />
      </div>
    </div>
  );
}

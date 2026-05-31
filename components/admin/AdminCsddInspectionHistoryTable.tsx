"use client";

import {
  groupTechnicalInspectionsByYear,
  isoDateToLvDisplay,
  previousInspectionBlockToRow,
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
      <p className="border-b border-slate-100 bg-slate-50/90 px-1.5 py-1 text-[10px] font-medium leading-snug text-[var(--color-apple-text)]">
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
      {row.notes?.trim() ? (
        <p className="px-1.5 py-0.5 text-[10px] leading-snug text-[var(--color-provin-muted)]">
          <span className="text-[var(--color-apple-text)]">Piezīmes:</span> {row.notes.trim()}
        </p>
      ) : null}
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
            <th className={mileCell}>Kods</th>
            <th className={`${mileCell} w-10 text-center`}>Nov.</th>
            <th className={mileCell}>Trūkumi vai bojājumi</th>
          </tr>
        </thead>
        <tbody>
          {(row.defects ?? []).length > 0 ? (
            (row.defects ?? []).map((d, i) => (
              <tr key={`${d.code}-${i}`} className="border-b border-slate-100 last:border-b-0">
                <td className={`${mileCell} align-top tabular-nums text-[var(--color-provin-muted)]`}>
                  {d.code || "—"}
                </td>
                <td className={`${mileCell} align-top text-center tabular-nums ${ratingClass(d.rating)}`}>
                  {d.rating || "—"}
                </td>
                <td className={`${mileCell} align-top leading-snug text-[var(--color-apple-text)]`}>
                  {d.description || "—"}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className={`${mileCell} text-[var(--color-provin-muted)]`}>
                Nav reģistrētu trūkumu vai bojājumu.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
          <div className="overflow-x-auto rounded-lg border border-slate-200/90 bg-white">
            {(byYear.get(year) ?? []).map((row) => (
              <CsddInspectionBlock key={row.date + row.inspectionType} row={row} historic={row.date !== newestDate} />
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
  const dateDisplay = prevInspectionDateIso.trim()
    ? isoDateToLvDisplay(prevInspectionDateIso)
    : "";
  const row = previousInspectionBlockToRow(block, dateDisplay);
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200/90 bg-white">
      <CsddInspectionBlock
        row={row}
        odometer={block.odometer}
        nextInspectionDateText={block.nextInspectionDateText}
      />
    </div>
  );
}

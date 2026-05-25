"use client";

import type { OutvinDealerReport, OutvinEquipmentLine, OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import {
  OUTVIN_VEHICLE_INFO_ROWS,
  emptyOutvinDealerReport,
  emptyOutvinEquipmentLine,
  outvinEquipmentLineHasData,
} from "@/lib/outvin-dealer-types";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { SUBHEADING_LUCIDE } from "@/lib/admin-lucide-registry";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const subHead =
  "mb-1 mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 first:mt-1";

type Props = {
  report: OutvinDealerReport;
  onChange: (next: OutvinDealerReport) => void;
  readOnly?: boolean;
  disabled?: boolean;
};

export function AdminOutvinDealerReportFields({ report, onChange, readOnly, disabled }: Props) {
  const patchVehicle = (key: keyof OutvinVehicleInfo, value: string) => {
    onChange({
      ...report,
      vehicleInfo: { ...report.vehicleInfo, [key]: value },
    });
  };

  const setEquipment = (next: OutvinEquipmentLine[]) => {
    onChange({ ...report, equipment: next });
  };

  const setEquipRow = (index: number, patch: Partial<OutvinEquipmentLine>) => {
    const rows = [...report.equipment];
    rows[index] = { ...rows[index]!, ...patch };
    setEquipment(rows.filter(outvinEquipmentLineHasData).length > 0 ? rows : []);
  };

  const addEquipRow = () => {
    setEquipment([...report.equipment, emptyOutvinEquipmentLine()]);
  };

  const displayEquip =
    report.equipment.length > 0 ? report.equipment : readOnly ? [] : [emptyOutvinEquipmentLine()];

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-2">
      <p className={subHead}>
        <AdminProvinLucide icon={SUBHEADING_LUCIDE.mileage} />
        Transporta informācija
      </p>
      <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
        {OUTVIN_VEHICLE_INFO_ROWS.map(({ key, labelLv }) => (
          <label key={key} className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[9px] font-medium text-[var(--color-provin-muted)]">{labelLv}</span>
            {readOnly ? (
              <span className="text-[11px] text-[var(--color-provin-muted)]">
                {report.vehicleInfo[key].trim() || "—"}
              </span>
            ) : (
              <input
                type="text"
                className={inp}
                value={report.vehicleInfo[key]}
                disabled={disabled}
                onChange={(e) => patchVehicle(key, e.target.value)}
                aria-label={labelLv}
              />
            )}
          </label>
        ))}
      </div>

      <p className={subHead}>
        <AdminProvinLucide icon={SUBHEADING_LUCIDE.incidents} />
        Negadījumu pārbaude
      </p>
      {readOnly ? (
        <p className="whitespace-pre-wrap text-[11px] text-[var(--color-provin-muted)]">
          {report.accidentCheck.trim() || "—"}
        </p>
      ) : (
        <textarea
          className="mb-1 w-full min-h-[48px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug"
          rows={2}
          value={report.accidentCheck}
          disabled={disabled}
          onChange={(e) => onChange({ ...report, accidentCheck: e.target.value })}
          aria-label="Negadījumu pārbaude"
        />
      )}

      <p className={subHead}>Nozagts transportlīdzeklis (reģistrs)</p>
      {readOnly ? (
        <p className="whitespace-pre-wrap text-[11px] text-[var(--color-provin-muted)]">
          {report.stolenCheck.trim() || "—"}
        </p>
      ) : (
        <textarea
          className="mb-1 w-full min-h-[40px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug"
          rows={2}
          value={report.stolenCheck}
          disabled={disabled}
          onChange={(e) => onChange({ ...report, stolenCheck: e.target.value })}
          aria-label="Nozagts transportlīdzeklis"
        />
      )}

      <p className={subHead}>Komplektācija</p>
      {displayEquip.length === 0 && readOnly ? (
        <p className="text-[11px] text-slate-400">—</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200/90">
          <table className="w-full min-w-[240px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                <th className="px-1.5 py-0.5">Kods</th>
                <th className="px-1.5 py-0.5">Apraksts</th>
              </tr>
            </thead>
            <tbody>
              {displayEquip.map((line, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-1.5 py-0.5 align-top">
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{line.code.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={line.code}
                        disabled={disabled}
                        onChange={(e) => setEquipRow(i, { code: e.target.value })}
                        aria-label={`Komplektācijas kods ${i + 1}`}
                      />
                    )}
                  </td>
                  <td className="px-1.5 py-0.5 align-top">
                    {readOnly ? (
                      <span className="text-[var(--color-provin-muted)]">{line.description.trim() || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        className={inp}
                        value={line.description}
                        disabled={disabled}
                        onChange={(e) => setEquipRow(i, { description: e.target.value })}
                        aria-label={`Komplektācijas apraksts ${i + 1}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!readOnly && !disabled ? (
        <button
          type="button"
          className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:bg-slate-50"
          onClick={addEquipRow}
        >
          + Rinda
        </button>
      ) : null}
    </div>
  );
}

export function ensureOutvinDealerReport(r: OutvinDealerReport | undefined): OutvinDealerReport {
  return r ?? emptyOutvinDealerReport();
}

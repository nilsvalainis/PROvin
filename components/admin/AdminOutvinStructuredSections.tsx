"use client";

import { useState } from "react";
import {
  AdminOutvinDealerReportFields,
  ensureOutvinDealerReport,
} from "@/components/admin/AdminOutvinDealerReportFields";
import {
  emptyOutvinDealerServiceRow,
  emptyOutvinEuropeanRow,
  outvinBundleHasStructuredContent,
  outvinDealerServiceRowHasData,
  outvinEuropeanRowHasData,
  type OutvinDataBundle,
  type OutvinDealerServiceRow,
  type OutvinEuropeanRegisterRow,
  type OutvinPdfSectionToggles,
} from "@/lib/outvin-data-bundle";
import { outvinBundleToDealerReport } from "@/lib/outvin-purchase-map";
const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

type Props = {
  bundle: OutvinDataBundle;
  readOnly: boolean;
  disabled?: boolean;
  onBundleChange: (next: OutvinDataBundle) => void;
};

function SectionToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[9px] text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function AdminOutvinStructuredSections({ bundle, readOnly, disabled, onBundleChange }: Props) {
  const [adminShow, setAdminShow] = useState({
    vehicle: true,
    dealer: true,
    us: true,
    eu: true,
  });

  if (!outvinBundleHasStructuredContent(bundle)) return null;

  const patchPdf = (patch: Partial<OutvinPdfSectionToggles>) => {
    onBundleChange({
      ...bundle,
      pdfSections: { ...bundle.pdfSections, ...patch },
    });
  };

  const report = outvinBundleToDealerReport(bundle);

  const setDealerRow = (index: number, patch: Partial<OutvinDealerServiceRow>) => {
    const rows = [...bundle.dealerServiceLog];
    rows[index] = { ...rows[index]!, ...patch };
    onBundleChange({
      ...bundle,
      dealerServiceLog: rows.filter(outvinDealerServiceRowHasData).length
        ? rows
        : [emptyOutvinDealerServiceRow()],
    });
  };

  const setEuRow = (index: number, patch: Partial<OutvinEuropeanRegisterRow>) => {
    const rows = [...bundle.europeanRegisters];
    rows[index] = { ...rows[index]!, ...patch };
    onBundleChange({
      ...bundle,
      europeanRegisters: rows.filter(outvinEuropeanRowHasData).length ? rows : [emptyOutvinEuropeanRow()],
    });
  };

  return (
    <div className="mt-3 space-y-3 border-t border-orange-200/60 pt-2">
      <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Strukturētie Outvin dati</p>
      <div className="flex flex-wrap gap-3">
        <SectionToggle
          label="Rādīt admin"
          checked={adminShow.vehicle}
          disabled={disabled}
          onChange={(v) => setAdminShow((s) => ({ ...s, vehicle: v }))}
        />
        <SectionToggle
          label="PDF: transporta / komplektācija"
          checked={bundle.pdfSections.vehicleEquipment}
          disabled={disabled || readOnly}
          onChange={(v) => patchPdf({ vehicleEquipment: v })}
        />
      </div>

      {adminShow.vehicle ? (
        <AdminOutvinDealerReportFields
          report={ensureOutvinDealerReport(report)}
          readOnly={readOnly}
          disabled={disabled}
          onChange={(next) =>
            onBundleChange({
              ...bundle,
              vehicleInfo: next.vehicleInfo,
              equipment: next.equipment,
              accidentCheck: next.accidentCheck,
              stolenCheck: next.stolenCheck,
            })
          }
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-slate-600">Dīlera servisa žurnāls (nobraukuma vēsture)</p>
        <div className="flex flex-wrap gap-2">
          <SectionToggle
            label="Admin"
            checked={adminShow.dealer}
            disabled={disabled}
            onChange={(v) => setAdminShow((s) => ({ ...s, dealer: v }))}
          />
          <SectionToggle
            label="PDF"
            checked={bundle.pdfSections.dealerService}
            disabled={disabled || readOnly}
            onChange={(v) => patchPdf({ dealerService: v })}
          />
        </div>
      </div>
      {adminShow.dealer ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200/90">
          <table className="w-full min-w-[320px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-slate-500">
                <th className="px-1.5 py-0.5">Datums</th>
                <th className="px-1.5 py-0.5">Nobraukums, km</th>
                <th className="px-1.5 py-0.5">Servisa veids / Piezīmes</th>
              </tr>
            </thead>
            <tbody>
              {bundle.dealerServiceLog.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-1.5 py-0.5">
                    <input
                      className={inp}
                      value={row.date}
                      disabled={readOnly || disabled}
                      onChange={(e) => setDealerRow(i, { date: e.target.value })}
                    />
                  </td>
                  <td className="px-1.5 py-0.5">
                    <input
                      className={inp}
                      value={row.odometer}
                      disabled={readOnly || disabled}
                      onChange={(e) => setDealerRow(i, { odometer: e.target.value })}
                    />
                  </td>
                  <td className="px-1.5 py-0.5">
                    <input
                      className={inp}
                      value={row.serviceNotes}
                      disabled={readOnly || disabled}
                      onChange={(e) => setDealerRow(i, { serviceNotes: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-slate-600">ASV vēsture un bojājumi</p>
        <div className="flex flex-wrap gap-2">
          <SectionToggle
            label="Admin"
            checked={adminShow.us}
            disabled={disabled}
            onChange={(v) => setAdminShow((s) => ({ ...s, us: v }))}
          />
          <SectionToggle
            label="PDF"
            checked={bundle.pdfSections.usCarfax}
            disabled={disabled || readOnly}
            onChange={(v) => patchPdf({ usCarfax: v })}
          />
        </div>
      </div>
      {adminShow.us ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {(
            [
              ["importDate", "Importa datums"],
              ["usOdometer", "ASV odometrs"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-[10px] text-slate-600">
              {label}
              <input
                className={`${inp} mt-0.5`}
                value={bundle.usCarfax[key]}
                disabled={readOnly || disabled}
                onChange={(e) =>
                  onBundleChange({ ...bundle, usCarfax: { ...bundle.usCarfax, [key]: e.target.value } })
                }
              />
            </label>
          ))}
          {(
            [
              ["registeredDamage", "Reģistrētie bojājumi / avārijas"],
              ["auctionData", "Izsoles dati"],
              ["notes", "Piezīmes"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-[10px] text-slate-600 sm:col-span-2">
              {label}
              <textarea
                className={`${inp} mt-0.5 min-h-[48px]`}
                rows={2}
                value={bundle.usCarfax[key]}
                disabled={readOnly || disabled}
                onChange={(e) =>
                  onBundleChange({ ...bundle, usCarfax: { ...bundle.usCarfax, [key]: e.target.value } })
                }
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-slate-600">Eiropas reģistru dati</p>
        <div className="flex flex-wrap gap-2">
          <SectionToggle
            label="Admin"
            checked={adminShow.eu}
            disabled={disabled}
            onChange={(v) => setAdminShow((s) => ({ ...s, eu: v }))}
          />
          <SectionToggle
            label="PDF"
            checked={bundle.pdfSections.europeanRegisters}
            disabled={disabled || readOnly}
            onChange={(v) => patchPdf({ europeanRegisters: v })}
          />
        </div>
      </div>
      {adminShow.eu ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200/90">
          <table className="w-full min-w-[360px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-slate-500">
                <th className="px-1.5 py-0.5">Datums</th>
                <th className="px-1.5 py-0.5">Valsts</th>
                <th className="px-1.5 py-0.5">Veids</th>
                <th className="px-1.5 py-0.5">Dati</th>
              </tr>
            </thead>
            <tbody>
              {bundle.europeanRegisters.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {(["date", "country", "registerType", "details"] as const).map((field) => (
                    <td key={field} className="px-1.5 py-0.5">
                      <input
                        className={inp}
                        value={row[field]}
                        disabled={readOnly || disabled}
                        onChange={(e) => setEuRow(i, { [field]: e.target.value })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

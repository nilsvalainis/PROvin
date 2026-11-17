"use client";

import { useMemo, useState } from "react";
import {
  applyIrissScanMakeModelEdit,
  applyIrissScanNameSuggestion,
  applyIrissScanRangeEdit,
  applyIrissScanSpecTextEdit,
  irissScanCriteriaView,
  irissScanHasStructuredCriteria,
  suggestIrissScanCriteriaFromName,
  type IrissScanRangeField,
} from "@/lib/iriss-scan-criteria";
import {
  IRISS_SPEC_MULTI_OPTIONS,
  irissSpecMultiCustom,
  irissSpecMultiGroups,
  toggleIrissSpecMulti,
  type IrissSpecMultiKind,
} from "@/lib/iriss-order-spec-selects";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

const input =
  "h-10 w-full min-w-0 rounded-[12px] px-3 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink3)]";

function RangeRow({
  label,
  unit,
  from,
  to,
  fromField,
  toField,
  placeholder,
  onEdit,
}: {
  label: string;
  unit?: string;
  from: string;
  to: string;
  fromField: IrissScanRangeField;
  toField: IrissScanRangeField;
  placeholder: [string, string];
  onEdit: (field: IrissScanRangeField, raw: string) => void;
}) {
  return (
    <div className="min-w-0" role="group" aria-label={label}>
      <span className="mb-1 block text-[12px] font-medium text-[var(--ink3)]">
        {label}
        {unit ? `, ${unit}` : ""}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <input className={input} inputMode="numeric" aria-label={`${label} no`} placeholder={`no ${placeholder[0]}`} value={from} onChange={(e) => onEdit(fromField, e.target.value)} />
        <input className={input} inputMode="numeric" aria-label={`${label} līdz`} placeholder={`līdz ${placeholder[1]}`} value={to} onChange={(e) => onEdit(toField, e.target.value)} />
      </div>
    </div>
  );
}

/** Tās pašas vairāku izvēļu pogas kā pasūtījuma «Meklēšanas filtri» (glabājas teksta laukā). */
function SpecChips({ label, kind, value, onChange }: { label: string; kind: IrissSpecMultiKind; value: string; onChange: (v: string) => void }) {
  const groups = irissSpecMultiGroups(kind, value);
  const custom = irissSpecMultiCustom(kind, value);
  return (
    <div className="min-w-0" role="group" aria-label={label}>
      <span className="mb-1 block text-[12px] font-medium text-[var(--ink3)]">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {IRISS_SPEC_MULTI_OPTIONS[kind].map((o) => {
          const on = groups.includes(o.group);
          return (
            <button
              key={o.group}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleIrissSpecMulti(kind, value, o.group))}
              className={`inline-flex min-h-[34px] items-center gap-1 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ${
                on ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-fg)]" : "bg-[var(--s2)] text-[var(--ink2)]"
              }`}
            >
              {on ? <span aria-hidden>✓</span> : null}
              {o.label}
            </button>
          );
        })}
      </div>
      {custom ? <p className="mt-1 text-[12px] text-[var(--ink3)]">Ierakstīts: {custom}</p> : null}
    </div>
  );
}

/**
 * Radara meklējuma kritēriji strukturētos laukos (tā pati shēma kā pasūtījumam).
 * Vecam Radaram ar kritērijiem nosaukumā rāda ieteikumu; ierakstā tas nonāk tikai pēc «Saglabāt kritērijus».
 */
export function IrissScanCriteriaCard({ rec, onChange }: { rec: IrissScanRecord; onChange: (next: IrissScanRecord) => void }) {
  const view = irissScanCriteriaView(rec);
  const structured = irissScanHasStructuredCriteria(rec);
  const suggestion = useMemo(() => (structured ? null : suggestIrissScanCriteriaFromName(rec.brandModel)), [structured, rec.brandModel]);
  const [dismissed, setDismissed] = useState("");
  const edit = (field: IrissScanRangeField, raw: string) => onChange(applyIrissScanRangeEdit(rec, field, raw));

  return (
    <section className="mb-4 overflow-hidden rounded-3xl bg-[var(--s1)] p-3 shadow-[var(--sh)]" aria-label="Meklējuma kritēriji" data-iriss-scan-criteria>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--ink2)]">Meklējuma kritēriji</h2>
        <p className="text-[12px] text-[var(--ink3)]">{structured ? "Filtrē tāpat kā pasūtījumā" : "Vēl nav aizpildīti - lieto nosaukumu un saites"}</p>
      </div>

      {suggestion && dismissed !== rec.brandModel ? (
        <div className="mb-3 rounded-2xl bg-[var(--s2)] p-3" data-iriss-scan-name-suggestion>
          <p className="text-[13px] font-semibold text-[var(--ink)]">Ieteikums no nosaukuma</p>
          <p className="mt-0.5 text-[12px] text-[var(--ink3)]">Nekas nav saglabāts. Pārbaudi un spied «Saglabāt kritērijus». Nosaukums nemainās.</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {suggestion.summary.map((line) => (
              <li key={line} className="rounded-full bg-[var(--s1)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink)]">
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange(applyIrissScanNameSuggestion(rec, suggestion))}
              className="inline-flex h-10 items-center rounded-full bg-[var(--chip-active-bg)] px-4 text-[13px] font-semibold text-[var(--chip-active-fg)]"
            >
              Saglabāt kritērijus
            </button>
            <button
              type="button"
              onClick={() => setDismissed(rec.brandModel)}
              className="inline-flex h-10 items-center rounded-full bg-[var(--s1)] px-4 text-[13px] font-semibold text-[var(--ink2)]"
            >
              Neizmantot
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="mb-1 block text-[12px] font-medium text-[var(--ink3)]">Marka</span>
          <input className={input} placeholder="piem., Audi" value={view.make} onChange={(e) => onChange(applyIrissScanMakeModelEdit(rec, "make", e.target.value))} />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-[12px] font-medium text-[var(--ink3)]">Modelis (vairākus ar komatu)</span>
          <input className={input} placeholder="piem., A4, A6" value={view.models} onChange={(e) => onChange(applyIrissScanMakeModelEdit(rec, "models", e.target.value))} />
        </label>
        <RangeRow label="Gadi" from={view.yearFrom} to={view.yearTo} fromField="yearFrom" toField="yearTo" placeholder={["2015", "2020"]} onEdit={edit} />
        <RangeRow label="Nobraukums" unit="km" from={view.mileageFrom} to={view.mileageTo} fromField="mileageFrom" toField="mileageTo" placeholder={["50000", "200000"]} onEdit={edit} />
        <RangeRow label="Cena (sludinājumā)" unit="€" from={view.priceFrom} to={view.priceTo} fromField="priceFrom" toField="priceTo" placeholder={["3000", "12000"]} onEdit={edit} />
        <RangeRow label="Jauda" unit="kW" from={view.kwFrom} to={view.kwTo} fromField="kwFrom" toField="kwTo" placeholder={["100", "150"]} onEdit={edit} />
        <RangeRow label="Tilpums" unit="cm³" from={view.ccFrom} to={view.ccTo} fromField="ccFrom" toField="ccTo" placeholder={["1900", "2100"]} onEdit={edit} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SpecChips label="Degviela" kind="fuel" value={rec.engineType} onChange={(v) => onChange(applyIrissScanSpecTextEdit(rec, "engineType", v))} />
        <SpecChips label="Ātrumkārba" kind="gearbox" value={rec.transmission} onChange={(v) => onChange(applyIrissScanSpecTextEdit(rec, "transmission", v))} />
      </div>
    </section>
  );
}

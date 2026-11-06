"use client";

import { useEffect, useRef, useState } from "react";
import {
  IRISS_SCAN_BODY_OPTIONS,
  IRISS_SCAN_FUEL_OPTIONS,
  IRISS_SCAN_GEARBOX_OPTIONS,
  irissScanCriteriaForm,
  irissScanCriteriaIsStored,
  parseIrissScanCriteriaNumber,
  patchIrissScanCriteria,
  type IrissScanCriteriaForm,
  type IrissScanCriteriaFormKey,
} from "@/lib/iriss-scan-criteria";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

type NumberKind = Parameters<typeof parseIrissScanCriteriaNumber>[1];

const inputClass =
  "min-w-0 flex-1 rounded-xl bg-[var(--s2)] px-3 py-2 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink3)] focus:shadow-[inset_0_0_0_1px_var(--ink3)]";

/** Teksts, ko saglabā pēc fokusa zaudēšanas (lai "Audi, " neapgrieztu rakstīšanas laikā). */
function DraftText({
  value,
  placeholder,
  label,
  onCommit,
}: {
  value: string;
  placeholder: string;
  label: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  return (
    <input
      data-bare
      className={inputClass}
      value={draft}
      placeholder={placeholder}
      aria-label={label}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        if (draft.trim() !== value.trim()) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** Skaitlis: derīgu vērtību saglabā uzreiz; nederīgu pēc fokusa zaudēšanas atjauno. */
function DraftNumber({
  value,
  kind,
  placeholder,
  label,
  onCommit,
}: {
  value: string;
  kind: NumberKind;
  placeholder: string;
  label: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  const invalid = draft.trim() !== "" && parseIrissScanCriteriaNumber(draft, kind) == null;
  return (
    <input
      data-bare
      inputMode="numeric"
      className={`${inputClass} w-0 ${invalid ? "shadow-[inset_0_0_0_1px_var(--bad)]" : ""}`}
      value={draft}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid || undefined}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (!next.trim() || parseIrissScanCriteriaNumber(next, kind) != null) onCommit(next);
      }}
      onBlur={() => {
        focused.current = false;
        if (invalid) setDraft(value);
      }}
    />
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center gap-3">
      <span className="w-[5.5rem] shrink-0 text-[12px] font-medium text-[var(--ink3)]">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Chips<T extends string>({
  options,
  selected,
  label,
  onChange,
}: {
  options: ReadonlyArray<readonly [T, string]>;
  selected: readonly T[];
  label: string;
  onChange: (next: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 py-1" role="group" aria-label={label}>
      {options.map(([value, text]) => {
        const on = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((x) => x !== value) : [...selected, value])}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              on ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-fg)]" : "bg-[var(--s2)] text-[var(--ink2)]"
            }`}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Radara kritēriji reālos laukos (marka, modelis, gadi, cena, nobraukums, jauda, degviela, kārba, virsbūve).
 * Vecam ierakstam vērtības ir nolasītas no nosaukuma un teksta laukiem; pirmais labojums tās saglabā.
 */
export function IrissScanCriteriaFields({
  rec,
  onChange,
}: {
  rec: IrissScanRecord;
  onChange: (next: IrissScanRecord) => void;
}) {
  const { form, origin } = irissScanCriteriaForm(rec);
  const stored = irissScanCriteriaIsStored(rec);
  const derived = !stored && Object.keys(origin).length > 0;
  const set = <K extends IrissScanCriteriaFormKey>(key: K, value: IrissScanCriteriaForm[K]) =>
    onChange(patchIrissScanCriteria(rec, key, value));
  const range = (
    label: string,
    from: "yearFrom" | "budgetFrom" | "mileageFrom" | "kwFrom",
    to: "yearTo" | "budgetTo" | "mileageTo" | "kwTo",
    kind: NumberKind,
    unit: string,
  ) => (
    <Row label={label}>
      <DraftNumber value={form[from]} kind={kind} placeholder="no" label={`${label} no`} onCommit={(v) => set(from, v)} />
      <span className="text-[var(--ink3)]">-</span>
      <DraftNumber value={form[to]} kind={kind} placeholder="līdz" label={`${label} līdz`} onCommit={(v) => set(to, v)} />
      {unit ? <span className="w-8 shrink-0 text-[12px] text-[var(--ink3)]">{unit}</span> : null}
    </Row>
  );

  return (
    <section className="mb-4 overflow-hidden rounded-3xl bg-[var(--s1)] p-3 shadow-[var(--sh)]" data-iriss-scan-criteria>
      <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--ink2)]">Kritēriji</h2>
      {derived ? (
        <p className="mb-2 text-[12px] text-[var(--ink3)]">Nolasīts no nosaukuma. Labojot kritēriji saglabāsies laukos.</p>
      ) : null}
      <div className="space-y-1">
        <Row label="Marka">
          <DraftText value={form.make} placeholder="Audi" label="Marka" onCommit={(v) => set("make", v)} />
        </Row>
        <Row label="Modelis">
          <DraftText value={form.models} placeholder="A4, A6" label="Modelis" onCommit={(v) => set("models", v)} />
        </Row>
        {range("Gadi", "yearFrom", "yearTo", "year", "")}
        {range("Cena", "budgetFrom", "budgetTo", "budget", "€")}
        {range("Nobraukums", "mileageFrom", "mileageTo", "mileage", "km")}
        {range("Jauda", "kwFrom", "kwTo", "kw", "kW")}
        <Row label="Degviela">
          <Chips options={IRISS_SCAN_FUEL_OPTIONS} selected={form.fuel} label="Degviela" onChange={(v) => set("fuel", v)} />
        </Row>
        <Row label="Kārba">
          <Chips options={IRISS_SCAN_GEARBOX_OPTIONS} selected={form.gearbox} label="Kārba" onChange={(v) => set("gearbox", v)} />
        </Row>
        <Row label="Virsbūve">
          <Chips options={IRISS_SCAN_BODY_OPTIONS} selected={form.bodyTypes} label="Virsbūve" onChange={(v) => set("bodyTypes", v)} />
        </Row>
      </div>
    </section>
  );
}

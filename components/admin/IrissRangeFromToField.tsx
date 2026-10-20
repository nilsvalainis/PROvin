"use client";

/** Kompakts no-līdz pāris IRISS specifikācijā. Bez garām svītrām. */
export function IrissRangeFromToField({
  label,
  unit,
  phoneUnit,
  required,
  from,
  to,
  onFrom,
  onTo,
  error,
  fromPlaceholder = "no",
  toPlaceholder = "līdz",
  inputClassName,
  inputMode = "decimal",
}: {
  label: string;
  unit?: string;
  /** Tikai telefonā (desktop paliek `unit`). */
  phoneUnit?: string;
  required?: boolean;
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  error?: string | null;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  inputClassName: string;
  inputMode?: "decimal" | "numeric";
}) {
  const fromMissing = Boolean(required && !from.trim());
  const toMissing = Boolean(required && !to.trim());
  const inputBase = [
    inputClassName,
    "iriss-range-input",
    unit ? "iriss-range-input-has-unit" : "",
    phoneUnit ? "iriss-range-input-has-phone-unit" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const unitMarks = unit || phoneUnit ? (
    <>
      {unit ? <span className="iriss-range-unit-desk">{unit}</span> : null}
      {phoneUnit ? <span className="iriss-range-unit-phone">{phoneUnit}</span> : null}
    </>
  ) : null;

  return (
    <div className="iriss-range-field min-w-0">
      <span className="iriss-range-label">
        {label}
        {required ? (
          <span className="iriss-range-req" aria-hidden>
            {" *"}
          </span>
        ) : null}
      </span>
      <div className="iriss-range-pair">
        <label className="iriss-range-input-wrap">
          <span className="sr-only">{label} no</span>
          <input
            className={fromMissing ? `${inputBase} iriss-range-input-missing` : inputBase}
            value={from}
            onChange={(e) => onFrom(e.target.value)}
            placeholder={fromPlaceholder}
            inputMode={inputMode}
            autoComplete="off"
            aria-label={`${label} no`}
            aria-required={required || undefined}
            aria-invalid={fromMissing || undefined}
          />
          {unitMarks ? (
            <span className="iriss-range-unit" data-unit={unit || phoneUnit} aria-hidden>
              {unitMarks}
            </span>
          ) : null}
        </label>
        <span className="iriss-range-sep" aria-hidden>
          -
        </span>
        <label className="iriss-range-input-wrap">
          <span className="sr-only">{label} līdz</span>
          <input
            className={toMissing ? `${inputBase} iriss-range-input-missing` : inputBase}
            value={to}
            onChange={(e) => onTo(e.target.value)}
            placeholder={toPlaceholder}
            inputMode={inputMode}
            autoComplete="off"
            aria-label={`${label} līdz`}
            aria-required={required || undefined}
            aria-invalid={toMissing || undefined}
          />
          {unitMarks ? (
            <span className="iriss-range-unit" data-unit={unit || phoneUnit} aria-hidden>
              {unitMarks}
            </span>
          ) : null}
        </label>
        {unit ? (
          <span className="iriss-range-unit-end" aria-hidden>
            {unit}
          </span>
        ) : null}
      </div>
      {error ? <p className="iriss-range-error mt-1 text-[11px] text-[#991b1b]">{error}</p> : null}
    </div>
  );
}

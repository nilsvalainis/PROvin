"use client";

/** Kompakts no-līdz pāris IRISS pasūtījuma specifikācijā. Bez garām svītrām. */
export function IrissRangeFromToField({
  label,
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
  return (
    <div className="min-w-0 sm:col-span-2">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)] sm:text-[11.5px] sm:font-semibold sm:text-[#374151]">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="block min-w-0">
          <span className="sr-only">{label} no</span>
          <input
            className={inputClassName}
            value={from}
            onChange={(e) => onFrom(e.target.value)}
            placeholder={fromPlaceholder}
            inputMode={inputMode}
            autoComplete="off"
            aria-label={`${label} no`}
          />
        </label>
        <label className="block min-w-0">
          <span className="sr-only">{label} līdz</span>
          <input
            className={inputClassName}
            value={to}
            onChange={(e) => onTo(e.target.value)}
            placeholder={toPlaceholder}
            inputMode={inputMode}
            autoComplete="off"
            aria-label={`${label} līdz`}
          />
        </label>
      </div>
      {error ? <p className="mt-1 text-[11px] text-[#991b1b]">{error}</p> : null}
    </div>
  );
}

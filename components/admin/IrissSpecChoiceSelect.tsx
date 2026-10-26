"use client";

export function IrissSpecChoiceSelect({
  label,
  value,
  options,
  onChange,
  selectClassName,
  labelClassName,
  filterMark,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  selectClassName: string;
  labelClassName?: string;
  /** `*`: lauks filtrē Meklētāju. */
  filterMark?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className={labelClassName ?? "mb-1 block text-[11.5px] font-semibold text-[#374151]"}>
        {label}
        {filterMark ? (
          <span className="iriss-range-req" aria-hidden>
            {" *"}
          </span>
        ) : null}
      </span>
      <select className={selectClassName} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
        <option value="">-</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

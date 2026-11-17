"use client";

import { IrissInternalNoteBadge } from "@/components/admin/IrissInternalNoteBadge";

export function IrissInternalNoteField({
  label,
  value,
  onChange,
  className,
  labelClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
  labelClassName?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className={labelClassName ?? "text-[11.5px] font-semibold text-[var(--iriss-ink-2)]"}>{label}</span>
        <IrissInternalNoteBadge />
      </span>
      <textarea className={className} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

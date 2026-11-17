"use client";

import type React from "react";

export const irissOfferFieldClass =
  "min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

export function IrissLabeledInput({
  label,
  wrapperClassName,
  ...rest
}: { label: string; wrapperClassName?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block min-w-0${wrapperClassName ? ` ${wrapperClassName}` : ""}`}>
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">{label}</span>
      <input className={irissOfferFieldClass} {...rest} />
    </label>
  );
}

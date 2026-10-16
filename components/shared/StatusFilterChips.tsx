"use client";

import type { ReactNode } from "react";
import {
  statusChipClass,
  statusChipRowClass,
  STATUS_CHIP_COUNT_CLASS,
  type StatusChipRowLayout,
  type StatusChipTone,
} from "@/lib/iriss-status-chip";

export function StatusFilterChipRow({
  layout,
  className = "",
  label = "Statusa filtrs",
  children,
}: {
  layout: StatusChipRowLayout;
  className?: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${statusChipRowClass(layout)} ${className}`.trim()} role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function StatusFilterChip({
  label,
  count,
  pressed,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  count?: number;
  pressed: boolean;
  tone: StatusChipTone;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
      data-tone={tone}
      className={`${statusChipClass(pressed, tone)} disabled:cursor-default disabled:opacity-40`}
    >
      {label}
      {typeof count === "number" ? <span className={STATUS_CHIP_COUNT_CLASS}>{count}</span> : null}
    </button>
  );
}

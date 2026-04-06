"use client";

import type { ReactNode } from "react";

type Props = {
  gradient: string;
  className?: string;
  /** Iekšējā rinda (noklusējums: px-2 py-1.5). */
  contentClassName?: string;
  children: ReactNode;
};

/** Kopīga josla ar lineāru gradientu (bez atsevišķa „shine” overlay). */
export function AdminGradientHeaderBar({
  gradient,
  className = "",
  contentClassName = "px-2 py-1.5",
  children,
}: Props) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="absolute inset-0 z-0"
        style={{ background: gradient, WebkitPrintColorAdjust: "exact" }}
        aria-hidden
      />
      <div className={`relative z-[1] flex items-center gap-2 ${contentClassName}`}>{children}</div>
    </div>
  );
}

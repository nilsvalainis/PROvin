"use client";

import type { ReactNode } from "react";

type Props = {
  gradient: string;
  className?: string;
  /** Iekšējā rinda (noklusējums: px-2 py-1.5). */
  contentClassName?: string;
  children: ReactNode;
};

/** Kopīga josla ar lineāru gradientu un „shine” slāņiem (PDF stila analogs). */
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
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(105deg,transparent_0%,rgba(255,255,255,0.1)_40%,rgba(255,255,255,0.26)_50%,transparent_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,transparent_45%)]"
        aria-hidden
      />
      <div className={`relative z-[1] flex items-center gap-2 ${contentClassName}`}>{children}</div>
    </div>
  );
}

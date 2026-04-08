"use client";

import type { LucideIcon } from "lucide-react";

/** ~15% mazāks nekā 20px; smalka līnija, pieklusināts zīmols — bez fona rāmjiem. */
export const ADMIN_LUCIDE_SIZE = 17;
export const ADMIN_LUCIDE_STROKE = 1.5;
const BASE = "shrink-0 text-[#0061D2]/65";

export function AdminProvinLucide({
  icon: Icon,
  className = "",
  size = ADMIN_LUCIDE_SIZE,
}: {
  icon: LucideIcon;
  className?: string;
  size?: number;
}) {
  return (
    <Icon
      size={size}
      strokeWidth={ADMIN_LUCIDE_STROKE}
      className={`${BASE} ${className}`.trim()}
      aria-hidden
    />
  );
}

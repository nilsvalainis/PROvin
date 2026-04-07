"use client";

import type { ReactNode } from "react";
import { shouldShowListedForSaleCriticalBanner } from "@/lib/tirgus-listed-ui";

function ListedSaleAlertIcons() {
  return (
    <svg
      className="h-2.5 w-2.5 shrink-0 text-red-600"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * „Auto pārdošanā (dienas)” — sarkans rāmis un gaiši sārts fons, ja dienu skaits > 200.
 */
export function ListedForSaleFieldChrome({ value, children }: { value: string; children: ReactNode }) {
  if (!shouldShowListedForSaleCriticalBanner(value)) return <>{children}</>;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-red-600 bg-rose-50/90 px-1 py-0.5">
      <ListedSaleAlertIcons />
      <span className="min-w-0 flex-1">{children}</span>
      <ListedSaleAlertIcons />
    </span>
  );
}

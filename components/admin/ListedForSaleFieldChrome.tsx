"use client";

import type { ReactNode } from "react";
import { shouldShowListedForSaleCriticalBanner } from "@/lib/tirgus-listed-ui";

function ListedSaleAlertIcon() {
  const stroke = "#FF0000";
  return (
    <svg
      className="h-3 w-3 shrink-0"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke={stroke} strokeWidth="2" />
      <path d="M12 8v4M12 16h.01" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * „Auto pārdošanā (dienas)” — sarkans rāmis un gaiši sārts fons, ja dienu skaits > 200.
 */
export function ListedForSaleFieldChrome({ value, children }: { value: string; children: ReactNode }) {
  if (!shouldShowListedForSaleCriticalBanner(value)) return <>{children}</>;
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <span className="flex shrink-0 items-center self-center" aria-hidden>
        <ListedSaleAlertIcon />
      </span>
      <span className="min-w-0 flex-1 rounded-md border-[2px] border-solid border-[#FF0000] bg-rose-50/95 px-1.5 py-0.5">
        {children}
      </span>
    </span>
  );
}

"use client";

import type { ReactNode } from "react";
import { shouldShowListedForSaleCriticalBanner } from "@/lib/tirgus-listed-ui";

const WARN_RED = "#FF4D4D";

/** Tā pati trīsstūņa zīmējums kā PDF brīdinājumam; +30% pret 13px bāzi (~17px). */
function ListedSaleWarnTriangleIcon() {
  return (
    <svg
      className="h-[17px] w-[17px] shrink-0"
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path d="M12 3 2 20h20L12 3z" stroke={WARN_RED} strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 9v5M12 17h.01" stroke={WARN_RED} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * „Auto pārdošanā (dienas)” — kreisajā pusē sarkans brīdinājuma trīsstūnis; skaitlis melns.
 */
export function ListedForSaleFieldChrome({ value, children }: { value: string; children: ReactNode }) {
  if (!shouldShowListedForSaleCriticalBanner(value)) return <>{children}</>;
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <span className="flex shrink-0 items-center self-center" aria-hidden>
        <ListedSaleWarnTriangleIcon />
      </span>
      <span className="min-w-0 flex-1 font-semibold text-[var(--color-apple-text)] [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-[var(--color-apple-text)] [&_input]:shadow-none [&_input]:ring-0 [&_input]:focus:ring-0 [&_span]:text-[var(--color-apple-text)]">
        {children}
      </span>
    </span>
  );
}

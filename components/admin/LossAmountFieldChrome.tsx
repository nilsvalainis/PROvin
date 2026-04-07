"use client";

import type { ReactNode } from "react";
import { getLossAmountUiFlag } from "@/lib/loss-amount-ui";

function LossAmountAlertIcons({ tier }: { tier: "yellow" | "red" }) {
  const stroke = tier === "red" ? "#DC2626" : "#F59E0B";
  return (
    <svg
      className="h-2.5 w-2.5 shrink-0"
      width="10"
      height="10"
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
 * „Zaudējumu summa” lauks — ierāmējums un (!) ikonas, ja summa ir zem / virs 1000 EUR sliekšņa.
 */
export function LossAmountFieldChrome({ value, children }: { value: string; children: ReactNode }) {
  const flag = getLossAmountUiFlag(value);
  if (flag === "none") return <>{children}</>;
  const tier = flag === "red" ? "red" : "yellow";
  const shell =
    tier === "red"
      ? "inline-flex max-w-full items-center gap-1 rounded-md border border-red-400 bg-red-50/90 px-1 py-0.5"
      : "inline-flex max-w-full items-center gap-1 rounded-md border border-amber-400 bg-amber-50/90 px-1 py-0.5";
  return (
    <span className={shell}>
      <LossAmountAlertIcons tier={tier} />
      <span className="min-w-0 flex-1">{children}</span>
      <LossAmountAlertIcons tier={tier} />
    </span>
  );
}

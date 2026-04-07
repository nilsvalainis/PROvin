"use client";

import type { ReactNode } from "react";
import { getLossAmountUiFlag } from "@/lib/loss-amount-ui";

function LossAmountAlertIcon({ tier }: { tier: "yellow" | "red" }) {
  const stroke = tier === "red" ? "#FF0000" : "#FFD700";
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
 * „Zaudējumu summa” lauks — ierāmējums un (!) ikonas, ja summa ir zem / virs 1000 EUR sliekšņa.
 */
export function LossAmountFieldChrome({ value, children }: { value: string; children: ReactNode }) {
  const flag = getLossAmountUiFlag(value);
  if (flag === "none") return <>{children}</>;
  const tier = flag === "red" ? "red" : "yellow";
  const frame =
    tier === "red"
      ? "rounded-md border-[2px] border-solid border-[#FF0000] bg-red-50/95 px-1.5 py-0.5"
      : "rounded-md border-[2px] border-solid border-[#FFD700] bg-yellow-50/95 px-1.5 py-0.5";
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <span className="flex shrink-0 items-center self-center" aria-hidden>
        <LossAmountAlertIcon tier={tier} />
      </span>
      <span className={`min-w-0 flex-1 ${frame}`}>{children}</span>
    </span>
  );
}

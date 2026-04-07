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

const numericWarnInner =
  "min-w-0 flex-1 font-semibold border-0 bg-transparent shadow-none ring-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:shadow-none [&_input]:ring-0 [&_input]:focus:ring-0";

/**
 * „Zaudējumu summa” — skaitlis krāsā (sarkans/dzeltens), viena (!) ikona kreisajā pusē; bez rāmja un fona.
 */
export function LossAmountFieldChrome({ value, children }: { value: string; children: ReactNode }) {
  const flag = getLossAmountUiFlag(value);
  if (flag === "none") return <>{children}</>;
  const tier = flag === "red" ? "red" : "yellow";
  const textCls =
    tier === "red"
      ? "text-red-600 [&_input]:text-red-600 [&_span]:text-red-600"
      : "text-yellow-600 [&_input]:text-yellow-600 [&_span]:text-yellow-600";
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <span className="flex shrink-0 items-center self-center" aria-hidden>
        <LossAmountAlertIcon tier={tier} />
      </span>
      <span className={`${numericWarnInner} ${textCls}`}>{children}</span>
    </span>
  );
}

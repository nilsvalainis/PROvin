"use client";

import { useEffect, useState } from "react";
import { IRISS_OFFER_PUBLIC_LABELS } from "@/lib/iriss-offer-client-link";
import {
  formatOfferDeadlineUntilLv,
  offerCountdown,
  offerCountdownSpokenLv,
  offerCountdownTickMs,
} from "@/lib/iriss-offer-countdown";

/** Taimeris; pie 0 izsauc onExpire bez lapas pārlādes. */
export function IrissOfferPublicCountdown({
  deadlineAt,
  skewMs,
  onExpire,
}: {
  deadlineAt: string;
  skewMs: number;
  onExpire: () => void;
}) {
  const deadlineMs = Date.parse(deadlineAt);
  const [now, setNow] = useState(() => Date.now() + skewMs);

  useEffect(() => {
    const wait = offerCountdownTickMs(deadlineMs, now);
    if (wait <= 0) {
      onExpire();
      return;
    }
    const t = window.setTimeout(() => setNow(Date.now() + skewMs), wait);
    return () => window.clearTimeout(t);
  }, [deadlineMs, now, skewMs, onExpire]);

  const c = offerCountdown(deadlineMs, now);
  if (c.mode === "expired") return null;
  const urgent = c.mode === "hours";
  const spoken = offerCountdownSpokenLv(c);

  return (
    <div>
      <p className="text-center text-[13px] font-medium text-[#52525b]">{IRISS_OFFER_PUBLIC_LABELS.validFor}</p>
      <div className="mt-2.5 grid grid-cols-3 gap-2" aria-hidden="true">
        {c.cells.map((cell, i) => (
          <div
            key={i}
            className={`rounded-xl border px-2 py-2.5 text-center ${
              urgent ? "border-[#fdba74] bg-[#fff7ed]" : "border-[#e4e4e7] bg-[#fafafa]"
            }`}
          >
            <span
              className={`block text-[24px] font-bold leading-none tabular-nums ${urgent ? "text-[#9a3412]" : "text-[#111827]"}`}
            >
              {cell.value}
            </span>
            <span className="mt-1.5 block text-[12px] text-[#52525b]">{cell.label}</span>
          </div>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {spoken}
      </span>
      <p className="mt-2 text-center text-[12px] text-[#6e6e73]">{formatOfferDeadlineUntilLv(deadlineAt, now)}</p>
    </div>
  );
}

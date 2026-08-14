"use client";

import { useEffect, useState } from "react";
import { ADMIN_AI_USAGE_EVENT, formatAiUsd, type AiUsageSummary } from "@/lib/ai-usage";

type Totals = {
  usd: number;
  calls: number;
  lastLine: string;
};

export function AdminAiSessionCostBar() {
  const [tot, setTot] = useState<Totals>({ usd: 0, calls: 0, lastLine: "" });

  useEffect(() => {
    const onUsage = (ev: Event) => {
      const usage = (ev as CustomEvent<AiUsageSummary>).detail;
      if (!usage || usage.calls <= 0) return;
      setTot((prev) => ({
        usd: Math.round((prev.usd + usage.usdEstimate) * 10_000) / 10_000,
        calls: prev.calls + usage.calls,
        lastLine: usage.models[0]?.replace(/^models\//, "") ?? prev.lastLine,
      }));
    };
    window.addEventListener(ADMIN_AI_USAGE_EVENT, onUsage);
    return () => window.removeEventListener(ADMIN_AI_USAGE_EVENT, onUsage);
  }, []);

  if (tot.calls <= 0) return null;

  return (
    <span
      className="max-w-[14rem] truncate text-[10px] font-medium tabular-nums text-[var(--color-provin-muted)]"
      title={`Šajā pārlūka sesijā AI izsaukumi šajā atskaitē. Aptuveni, ne rēķins.${tot.lastLine ? ` Pēdējais: ${tot.lastLine}` : ""}`}
      role="status"
    >
      AI ≈ {formatAiUsd(tot.usd)}
      <span className="font-normal text-slate-400"> · {tot.calls}</span>
    </span>
  );
}

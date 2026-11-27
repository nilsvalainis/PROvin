"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dealerForecastInputFromBlocks,
  dealerForecastNextAfterOneautoNoData,
  forecastDealerCoverage,
  parseDealerCoverageAggregate,
  type DealerCoverageCounts,
  type DealerForecastBlocksLike,
  type DealerForecastLevel,
  type DealerForecastRow,
  DEALER_FORECAST_YEAR_GROUP_LABEL,
} from "@/lib/dealer-coverage-forecast";

/** Dinamiskais agregāts - viens pieprasījums lapā (10 min kešs). */
let cache: { at: number; promise: Promise<DealerCoverageCounts | null> } | null = null;
const CACHE_MS = 10 * 60 * 1000;

function loadCounts(): Promise<DealerCoverageCounts | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.promise;
  const promise =
    typeof fetch === "function"
      ? fetch("/api/admin/dealer-forecast", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .then((j: unknown) => (j && typeof j === "object" ? parseDealerCoverageAggregate(j).counts : null))
          .catch(() => null)
      : Promise.resolve(null);
  cache = { at: Date.now(), promise };
  return promise;
}

function useDealerCoverageCounts(): DealerCoverageCounts | null {
  const [counts, setCounts] = useState<DealerCoverageCounts | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCounts().then((c) => {
      if (alive && c && Object.keys(c).length) setCounts(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return counts;
}

const LEVEL_TONE: Record<DealerForecastLevel, string> = {
  augsta: "text-emerald-700",
  "vidēja": "text-orange-600",
  zema: "text-red-700",
  "nav zināms": "text-slate-500",
};

function rowTitle(r: DealerForecastRow, make: string | null, yearLabel: string): string {
  const pct = `${Math.round(r.p * 100)}%`;
  if (r.scope === "prior") return `${r.label}: ~${pct} (vidēji visām markām)`;
  const where = [make, r.scope === "year" ? yearLabel : ""].filter(Boolean).join(" ");
  return `${r.label}: ${pct} · ${where} ${r.hits}/${r.n}`;
}

/**
 * Kompakta rinda «Dīlera dati: OneAuto augsta (BMW 66/68) · CheckThisReg augsta · auto-records augsta»
 * (Nila «jā» 27.11). Secība = ieteicamā; pēc OneAuto «datu nav» nākamais avots izcelts.
 */
export function AdminDealerForecastRow({
  blocks,
  make,
  year,
  vin,
  oneautoNoData = false,
  variant = "desktop",
  className = "",
}: {
  /** Pasūtījuma avotu bloki (CSDD marka + gads). */
  blocks?: DealerForecastBlocksLike;
  /** Tieša marka (VIN SCAN: CSDD API marka vai virsraksts). */
  make?: string | null;
  year?: number | string | null;
  vin?: string | null;
  /** Dīlera ielase beidzās ar «datu nav» - izcel ieteicamo nākamo avotu. */
  oneautoNoData?: boolean;
  variant?: "desktop" | "glass" | "v4";
  className?: string;
}) {
  const dyn = useDealerCoverageCounts();
  const fromBlocks = blocks ? dealerForecastInputFromBlocks(blocks, vin) : null;
  const makeTexts = fromBlocks?.makeTexts ?? [];
  const resolvedYear = year ?? fromBlocks?.year ?? null;
  const fc = useMemo(
    () => forecastDealerCoverage({ make: make ?? "", makeTexts, year: resolvedYear, vin: vin ?? "" }, dyn),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [make, makeTexts.join("|"), resolvedYear, vin, dyn],
  );
  const next = oneautoNoData ? dealerForecastNextAfterOneautoNoData(fc) : null;
  const statsLabel = fc.statsMake && fc.make && fc.statsMake !== fc.make ? `${fc.make} → ${fc.statsMake}` : fc.statsMake;
  const yearLabel = fc.yearGroup ? DEALER_FORECAST_YEAR_GROUP_LABEL[fc.yearGroup] : "";
  const size = variant === "glass" ? "text-[13px]" : variant === "v4" ? "text-[12px]" : "text-[10.5px]";

  return (
    <p
      className={`flex flex-wrap items-baseline gap-x-1 gap-y-0.5 ${size} text-[var(--color-provin-muted)] ${className}`}
      data-dealer-forecast={fc.order.join(",")}
    >
      <span className="font-medium">Dīlera dati:</span>
      {fc.rows.map((r, i) => {
        const noData = oneautoNoData && r.source === "oneauto";
        const highlight = next === r.source;
        return (
          <span key={r.source} className="inline-flex items-baseline gap-x-1">
            {i > 0 ? <span aria-hidden>·</span> : null}
            <span
              title={highlight ? `Ieteicamais nākamais avots · ${rowTitle(r, statsLabel, yearLabel)}` : rowTitle(r, statsLabel, yearLabel)}
              data-forecast-source={r.source}
              data-forecast-level={noData ? "no_data" : r.level}
              {...(highlight ? { "data-forecast-next": "1" } : {})}
              className={highlight ? "rounded border border-slate-400 px-1 font-semibold text-[var(--color-apple-text)]" : ""}
            >
              {r.label}{" "}
              {noData ? (
                <span className="font-medium text-red-700">datu nav</span>
              ) : (
                <span className={`font-medium ${LEVEL_TONE[r.level]}`}>{r.level}</span>
              )}
              {r.source === "oneauto" && !noData && r.scope !== "prior" && statsLabel ? (
                <span>
                  {" "}
                  ({[statsLabel, r.scope === "year" ? yearLabel : ""].filter(Boolean).join(" ")} {r.hits}/{r.n})
                </span>
              ) : null}
            </span>
          </span>
        );
      })}
    </p>
  );
}

"use client";

import { useMemo } from "react";

import { browserFetchHandoff } from "@/lib/vin-scan/browser-fetch";

/**
 * Slēptais marķieris Tampermonkey v1.22.0: `data-provin-browser-fetch` + ids.
 * Tas pats mehānisms pasūtījuma kartītei un atsevišķajam VIN SCAN rīkam.
 */
export function AdminVinScanBrowserFetchHandoff({
  vin,
  at,
  rows,
  sessionId,
}: {
  vin: string;
  at: string;
  rows: readonly { id?: string; status?: string; summary?: string }[] | null | undefined;
  sessionId?: string;
}) {
  const handoff = useMemo(() => browserFetchHandoff(vin, at, rows), [vin, at, rows]);
  const cleanVin = vin.trim().toUpperCase();
  return (
    <span
      hidden
      data-provin-order-vin={cleanVin || undefined}
      {...(sessionId ? { "data-provin-order-session": sessionId } : {})}
      {...(handoff
        ? {
            "data-provin-browser-fetch": handoff.token,
            "data-provin-browser-fetch-ids": handoff.ids.join(","),
            ...(handoff.ids.includes("stat_vin") ? { "data-provin-stat-vin-fetch": handoff.token } : {}),
          }
        : {})}
    />
  );
}

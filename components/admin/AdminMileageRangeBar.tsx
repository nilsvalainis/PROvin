"use client";

import { useMemo } from "react";
import { formatKmLv, summarizeMileageRange } from "@/lib/admin-pro-overview-bars";

type OdometerRow = { date: string; odometer?: string };

/** Vienota nobraukuma diapazona josla visiem avotiem: pirmais un pēdējais rādījums no ievadītajām rindām. */
export function AdminMileageRangeBar({ rows }: { rows: readonly OdometerRow[] }) {
  const range = useMemo(
    () => summarizeMileageRange(rows.map((r) => ({ date: r.date ?? "", km: r.odometer ?? "" }))),
    [rows],
  );
  if (!range) return null;
  const single = range.readings < 2;
  const n = range.readings;
  return (
    <div
      className="provin-mileage-bar"
      aria-label={`Nobraukums ${range.firstYear} ${formatKmLv(range.firstKm)} km līdz ${range.lastYear} ${formatKmLv(range.lastKm)} km`}
    >
      <span className="provin-mileage-year">{range.firstYear}</span>
      <span className="provin-mileage-km">{formatKmLv(range.firstKm)}{single ? " km" : ""}</span>
      <span className="provin-mileage-track" aria-hidden>
        <span className="provin-mileage-fill" style={single ? { width: "6%" } : undefined} />
      </span>
      {single ? null : <span className="provin-mileage-km">{formatKmLv(range.lastKm)} km</span>}
      {single ? null : <span className="provin-mileage-year">{range.lastYear}</span>}
      <span className="provin-mileage-count">
        {n} {n % 10 === 1 && n % 100 !== 11 ? "rādījums" : "rādījumi"}
      </span>
    </div>
  );
}

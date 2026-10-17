"use client";

import { formatForensicsInt } from "@/lib/admin-ai-mileage-forensics";
import {
  applyOdometerAnomalyOverrides,
  classifyOdometerAnomalies,
  type ClassifiedOdometerAnomaly,
  type OdometerAnomalyOverride,
} from "@/lib/odometer-anomaly-classify";
import type { UnifiedMileageRow } from "@/lib/unified-mileage";

export function AdminOdometerAnomalyPanel({
  rows,
  overrides,
  onOverride,
}: {
  rows: UnifiedMileageRow[];
  overrides: OdometerAnomalyOverride[];
  onOverride: (next: OdometerAnomalyOverride) => void;
}) {
  const classified = classifyOdometerAnomalies(rows);
  if (classified.length === 0) return null;
  const overrideByKey = new Map(overrides.map((o) => [o.key, o]));
  const active = applyOdometerAnomalyOverrides(classified, overrides);

  return (
    <div
      className="mt-2 space-y-1.5 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-[12px] text-amber-950"
      role="status"
    >
      <p className="text-[11px] font-semibold">Nobraukuma anomālijas</p>
      <p className="text-[10px] leading-snug text-amber-900/80">
        Tikai admin brīdinājumi. Grafiku un datumu attēlojumu nemaina. Vienu klikšķi apstiprina vai atceļ karogu.
      </p>
      {classified.map((a) => {
        const ov = overrideByKey.get(a.key);
        const dismissed = ov?.action === "dismiss";
        const confirmed = ov?.action === "confirm";
        return (
          <AnomalyRow
            key={a.key}
            anomaly={a}
            dismissed={dismissed}
            confirmed={confirmed}
            onConfirm={() => onOverride({ key: a.key, action: "confirm" })}
            onDismiss={() => onOverride({ key: a.key, action: "dismiss" })}
          />
        );
      })}
      {active.some((a) => a.class === "rollback") ? (
        <p className="text-[10px] font-medium">Galvenē nedrīkst rakstīt „bez pretrunām”, kamēr ir nobraukuma kritums.</p>
      ) : null}
    </div>
  );
}

function AnomalyRow({
  anomaly,
  dismissed,
  confirmed,
  onConfirm,
  onDismiss,
}: {
  anomaly: ClassifiedOdometerAnomaly;
  dismissed: boolean;
  confirmed: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const isRollback = anomaly.class === "rollback";
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        dismissed
          ? "border-slate-200 bg-white/70 text-slate-600"
          : isRollback
            ? "border-red-200/90 bg-red-50 text-red-950"
            : "border-amber-200/80 bg-amber-50/80 text-amber-950"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide">{anomaly.labelLv}</p>
      <p className="mt-0.5 text-[11px] leading-snug">
        {formatForensicsInt(anomaly.fromKm)} km ({anomaly.fromDate}) → {formatForensicsInt(anomaly.toKm)} km (
        {anomaly.toDate}), kritums {formatForensicsInt(anomaly.dropKm)} km
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <button
          type="button"
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
            confirmed ? "bg-white/80 font-semibold" : "hover:bg-white/70"
          }`}
          onClick={onConfirm}
        >
          Apstiprināt
        </button>
        <button
          type="button"
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
            dismissed ? "bg-white/80 font-semibold" : "hover:bg-white/70"
          }`}
          onClick={onDismiss}
        >
          Atcelt karogu
        </button>
      </div>
    </div>
  );
}

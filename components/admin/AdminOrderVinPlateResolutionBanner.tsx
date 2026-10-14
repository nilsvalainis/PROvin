"use client";

import { useState } from "react";
import {
  orderVinPlateResolutionIsFailed,
  VIN_PLATE_RESOLVE_FAILED_LABEL,
  type OrderVinPlateResolution,
} from "@/lib/order-vin-plate-resolution";

type Props = {
  sessionId: string;
  resolution: OrderVinPlateResolution | null | undefined;
  licensePlate?: string | null;
  onResolved?: () => void;
};

export function AdminOrderVinPlateResolutionBanner({
  sessionId,
  resolution,
  licensePlate,
  onResolved,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plate = resolution?.plate || licensePlate?.trim() || "";
  const showFailed = orderVinPlateResolutionIsFailed(resolution) && plate;

  if (!showFailed) return null;

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/order-plate-vin-resolve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        effectiveVin?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Neizdevās atkārtot CSDD pieprasījumu.");
        return;
      }
      if (body.effectiveVin) onResolved?.();
      else window.location.reload();
    } catch {
      setError("Neizdevās atkārtot CSDD pieprasījumu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
      role="status"
    >
      <div className="min-w-0 text-[11px] leading-snug text-red-800">
        <span className="font-semibold uppercase tracking-wide text-red-700">{VIN_PLATE_RESOLVE_FAILED_LABEL}</span>
        <span className="mt-0.5 block">
          Numurzīme: <span className="font-mono font-medium">{plate}</span>
        </span>
        {error ? <span className="mt-1 block text-red-700">{error}</span> : null}
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md border border-red-300 bg-white px-2.5 py-1 text-[11px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
        disabled={busy}
        onClick={() => void retry()}
      >
        {busy ? "Meklē…" : "Mēģināt vēlreiz"}
      </button>
    </div>
  );
}

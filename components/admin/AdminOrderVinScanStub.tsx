"use client";

import { useEffect, useState } from "react";

import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import {
  buildOrderVinScanSummary,
  orderVinScanCompactHint,
  parseOrderVinScanRecord,
  type OrderVinScanRecord,
} from "@/lib/order-vin-scan";

/**
 * Pagaidu vienas rindas bloks. Pilnais VIN SCAN avotu izkārtojums gaida apstiprinātu maketu.
 */
export function AdminOrderVinScanStub({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: OrderVinScanRecord | null;
}) {
  const [record, setRecord] = useState<OrderVinScanRecord | null>(initial);

  useEffect(() => {
    setRecord(initial);
  }, [initial]);

  useEffect(() => {
    if (record?.status !== "running") return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/order-draft?sessionId=${encodeURIComponent(sessionId)}&workspace=1`, {
          credentials: "include",
        });
        if (!res.ok || stop) return;
        const json = (await res.json()) as { vinScan?: unknown };
        const next = parseOrderVinScanRecord(json.vinScan);
        if (next) setRecord(next);
      } catch {
        /* ignore */
      }
    };
    const timer = window.setInterval(() => void tick(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [sessionId, record?.status]);

  const summary = buildOrderVinScanSummary(record);
  const line =
    orderVinScanCompactHint(summary) ||
    (record?.status === "running" ? "VIN SCAN: pārbauda…" : "VIN SCAN: vēl nav skenēts");

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="vin-scan-avoti"
      className="rounded-xl border-0 bg-transparent shadow-[0_2px_22px_rgba(15,23,42,0.055)]"
      header={
        <h2 className="px-2 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
          VIN SCAN avoti
        </h2>
      }
    >
      <p className="px-2 pb-2 text-[11px] text-[var(--color-apple-text)]">{line}</p>
    </AdminCollapsibleShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  irissMobilePlateBusyCount,
  irissMobilePlateStripItems,
  type IrissMobilePlateStripItem,
} from "@/lib/iriss-mobile-plate-strip";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";

export function useIrissWaybillPlateStrip(enabled: boolean): {
  items: IrissMobilePlateStripItem[];
  loaded: boolean;
  busyCount: number;
} {
  const [items, setItems] = useState<IrissMobilePlateStripItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetch("/api/admin/iriss-pavadzimes?active=1", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { rows?: IrissPavadzimeListRow[] } | null;
        if (cancelled) return;
        const rows = res.ok && Array.isArray(json?.rows) ? json.rows : [];
        setItems(
          irissMobilePlateStripItems(
            rows.map((row) => ({
              plate: row.plate ?? "",
              validUntil: row.validUntil,
              issuedAt: row.issuedAt,
              number: row.number ?? "",
              brandModel: row.brandModel,
            })),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setItems(irissMobilePlateStripItems([]));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { items, loaded, busyCount: irissMobilePlateBusyCount(items) };
}

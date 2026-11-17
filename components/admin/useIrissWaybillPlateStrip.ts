"use client";

import { useEffect, useState } from "react";
import {
  irissMobilePlateBusyCount,
  irissMobilePlateStripItems,
  irissMobilePlateStripItemsFromPlates,
  type IrissMobilePlateStripItem,
} from "@/lib/iriss-mobile-plate-strip";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";
import type { WaybillPlateState } from "@/lib/iriss-waybill-plates";

/** `refreshKey`: mainot to, saraksts ielādējas no jauna (piem. atgriežoties lietotnē). */
export function useIrissWaybillPlateStrip(enabled: boolean, refreshKey = 0): {
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
        const json = (await res.json().catch(() => null)) as { rows?: IrissPavadzimeListRow[]; plates?: WaybillPlateState[] } | null;
        if (cancelled) return;
        if (res.ok && Array.isArray(json?.plates) && json.plates.length) {
          setItems(irissMobilePlateStripItemsFromPlates(json.plates));
          return;
        }
        const rows = res.ok && Array.isArray(json?.rows) ? json.rows : [];
        setItems(
          irissMobilePlateStripItems(
            rows.map((row) => ({
              plate: row.plate ?? "",
              validUntil: row.validUntil,
              issuedAt: row.issuedAt,
              number: row.number ?? "",
              brandModel: row.brandModel,
              archived: row.archived,
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
  }, [enabled, refreshKey]);

  return { items, loaded, busyCount: irissMobilePlateBusyCount(items) };
}

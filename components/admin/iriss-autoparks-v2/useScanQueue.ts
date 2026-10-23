"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultUploader, drainScanQueue, idbQueueStore, type QueuedScan } from "./scan-queue";

/** Šī auto rinda + tīkla stāvoklis. Tīklam atgriežoties un atverot lapu - augšupielāde pa vienam. */
export function useScanQueue(carId: string, onUploaded: () => void) {
  const [items, setItems] = useState<QueuedScan[]>([]);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    const all = await idbQueueStore.all().catch(() => [] as QueuedScan[]);
    setItems(all.filter((i) => i.carId === carId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }, [carId]);

  const drain = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const n = await drainScanQueue(idbQueueStore, defaultUploader, () => void refresh()).catch(() => 0);
    await refresh();
    if (n > 0) onUploaded();
  }, [onUploaded, refresh]);

  useEffect(() => {
    setOnline(navigator.onLine !== false);
    void refresh().then(drain);
    const on = () => {
      setOnline(true);
      void drain();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [drain, refresh]);

  return { items, online, drain, refresh };
}

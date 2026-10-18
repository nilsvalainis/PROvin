"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ADMIN_MOBILE_MQ, scheduleAdminIdleWork } from "@/lib/admin-mobile-shell";
import { irissWaybillMobileBarItems } from "@/lib/iriss-pavadzimes-mobile-bar";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";

function useIrissMobileViewport(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(ADMIN_MOBILE_MQ);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(ADMIN_MOBILE_MQ).matches,
    () => false,
  );
}

/** Mobilā josla virs IRISS satura. Dati no esošā aktīvo pavadzīmju pieprasījuma. */
export function IrissPavadzimesMobileBar() {
  const mobile = useIrissMobileViewport();
  const [rows, setRows] = useState<IrissPavadzimeListRow[]>([]);

  useEffect(() => {
    if (!mobile) return;
    let cancelled = false;
    const load = () => {
      void fetch("/api/admin/iriss-pavadzimes?active=1", { credentials: "include", cache: "no-store" })
        .then(async (res) => {
          const json = (await res.json().catch(() => null)) as { rows?: IrissPavadzimeListRow[] } | null;
          if (!cancelled && res.ok && Array.isArray(json?.rows)) setRows(json.rows);
        })
        .catch(() => undefined);
    };
    const cancelIdle = scheduleAdminIdleWork(load);
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [mobile]);

  if (!mobile || rows.length === 0) return null;
  const items = irissWaybillMobileBarItems(rows);

  return (
    <div className="mb-0 max-w-full md:hidden" aria-label="Pavadzīmju derīgums">
      <div className="flex max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <Link
            key={item.id}
            href="/admin/iriss/pavadzimes"
            className="iriss-waybill-chip inline-flex h-10 min-h-10 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 text-[12px] font-semibold shadow-sm ring-1 ring-[#E5E7EB]"
            style={{ color: item.urgent ? "#b91c1c" : "#15803d" }}
          >
            <span className="truncate" style={{ color: "inherit" }}>
              {item.plate}
            </span>
            <span className="tabular-nums" style={{ color: "inherit" }}>
              {item.daysLabel}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

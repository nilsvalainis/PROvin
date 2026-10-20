"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";
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

const IRISS_DETAIL_PATH = /^\/admin\/iriss\/(?:pasutijumi|scan)\/[^/]+$/;

/** Mobilā josla virs IRISS satura. Dati no esošā aktīvo pavadzīmju pieprasījuma. */
export function IrissPavadzimesMobileBar({ embedded = false }: { embedded?: boolean }) {
  const mobile = useIrissMobileViewport();
  const pathname = usePathname() || "";
  const hideBar =
    pathname.startsWith("/admin/iriss/sludinajumi") || IRISS_DETAIL_PATH.test(pathname);
  const [rows, setRows] = useState<IrissPavadzimeListRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mobile || hideBar) return;
    let cancelled = false;
    void fetch("/api/admin/iriss-pavadzimes?active=1", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { rows?: IrissPavadzimeListRow[] } | null;
        if (!cancelled && res.ok && Array.isArray(json?.rows)) setRows(json.rows);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mobile, hideBar]);

  if (!mobile || hideBar) return null;
  const rowClass = embedded
    ? "am-chip-fade -mr-4 flex max-w-full items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "flex max-w-full gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  if (!loaded) {
    return (
      <div className="mb-0 max-w-full md:hidden" aria-hidden>
        <div className={rowClass}>
          <span className="h-7 w-28 shrink-0 animate-pulse rounded-full bg-[var(--fill-secondary)]" />
          <span className="h-7 w-24 shrink-0 animate-pulse rounded-full bg-[var(--fill-secondary)]" />
          <span className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-[var(--fill-secondary)]" />
        </div>
      </div>
    );
  }
  if (rows.length === 0) return null;
  const items = irissWaybillMobileBarItems(rows);

  return (
    <div className="mb-0 max-w-full md:hidden" aria-label="Pavadzīmju derīgums">
      <div className={rowClass}>
        <span className="shrink-0 text-[12px] font-medium text-[var(--label-secondary)]">Pavadzīmes</span>
        {items.map((item) => (
          <Link
            key={item.id}
            href="/admin/iriss/pavadzimes"
            className="iriss-waybill-chip inline-flex h-7 max-w-[16rem] shrink-0 items-center rounded-full bg-[var(--fill-secondary)] px-2.5 text-[12px] font-medium text-[var(--label)]"
          >
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

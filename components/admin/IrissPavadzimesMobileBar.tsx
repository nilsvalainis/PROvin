"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { IrissPavadzimesPlateStrip } from "@/components/admin/IrissPavadzimesPlateStrip";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";

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

function isIrissMenuHome(pathname: string): boolean {
  return pathname === "/admin/iriss" || pathname === "/admin/iriss/";
}

/** Mobilā josla virs IRISS satura. Mini LV plāksnes + statuss / stundas, bez pavadzīmes numura. */
export function IrissPavadzimesMobileBar({
  embedded = false,
  force = false,
}: {
  embedded?: boolean;
  force?: boolean;
}) {
  const mobile = useIrissMobileViewport();
  const pathname = usePathname() || "";
  const hideBar =
    !force &&
    (isIrissMenuHome(pathname) ||
      pathname.startsWith("/admin/iriss/sludinajumi") ||
      IRISS_DETAIL_PATH.test(pathname));
  return <IrissPavadzimesPlateStrip enabled={mobile && !hideBar} embedded={embedded} />;
}

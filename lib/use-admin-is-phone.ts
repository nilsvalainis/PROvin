"use client";

import { useSyncExternalStore } from "react";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(ADMIN_MOBILE_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(ADMIN_MOBILE_MQ).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Telefona izkārtojums (matchMedia). Pārlūkā vērtība ir zināma jau pirmajā renderēšanā: agrāk (useState(false) +
 * useEffect) telefonā vispirms uzzīmējās datora izkārtojums ar atvērtiem blokiem, tad tie sakļāvās - pasūtījuma
 * lapa nolēca (23.11). Serverī / hidratācijā - `false`, tad React pārrenderē ar īsto vērtību.
 */
export function useAdminIsPhone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

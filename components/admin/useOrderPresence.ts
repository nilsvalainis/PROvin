"use client";

import { useEffect, useState } from "react";
import { getAdminBrowserClientId, shortBrowserLabel } from "@/lib/admin-workspace-client-signal";

export const ORDER_PRESENCE_HEARTBEAT_MS = 20_000;

export type OrderPresenceOther = { clientId: string; label: string; secondsAgo: number };

/** Heartbeat ik ~20 s (tikai redzamā cilnē). Atgriež citus pārlūkus/ierīces, kas pasūtījumu atvēruši pēdējās 60 s. */
export function useOrderPresence(sessionId: string, enabled: boolean): OrderPresenceOther[] {
  const [others, setOthers] = useState<OrderPresenceOther[]>([]);
  useEffect(() => {
    if (!enabled || !sessionId) {
      setOthers([]);
      return;
    }
    let cancelled = false;
    const clientId = getAdminBrowserClientId();
    const label = shortBrowserLabel(typeof navigator !== "undefined" ? navigator.userAgent : "");
    const beat = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fetch("/api/admin/order-draft/presence", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, clientId, label }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { others?: OrderPresenceOther[] } | null) => {
          if (cancelled || !d) return;
          setOthers(Array.isArray(d.others) ? d.others : []);
        })
        .catch(() => {});
    };
    beat();
    const t = window.setInterval(beat, ORDER_PRESENCE_HEARTBEAT_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, sessionId]);
  return others;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isTraficomFiAutoActive, type TraficomFiAutoStatus } from "@/lib/traficom-fi-auto-types";

const POLL_MS = 5000;
/** eParaksts gaida līdz 5 min (+ rinda) - aptauja beidzas pēc 8 min. */
const POLL_MAX_MS = 8 * 60 * 1000;

/**
 * VIN SCAN v4 rinda «Traficom (FI)» (`/api/admin/vin-scan/traficom`, atsauce `vs_<vin>`).
 * Automātiski sāk tikai, ja skenēšana atrada Somijas pazīmi (`signal.start`); poga - `start(true)`.
 */
export function useVinScanTraficom({
  vin,
  enabled,
  signal,
}: {
  vin: string;
  enabled: boolean;
  signal: { start: boolean; reason: string };
}): { status: TraficomFiAutoStatus | null; configured: boolean; busy: boolean; start: (force?: boolean) => void } {
  const [status, setStatus] = useState<TraficomFiAutoStatus | null>(null);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const autoTried = useRef("");
  const pollFrom = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !vin) return;
    try {
      const res = await fetch(`/api/admin/vin-scan/traficom?vin=${encodeURIComponent(vin)}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { status: TraficomFiAutoStatus | null; configured: boolean };
      setStatus(json.status);
      setConfigured(json.configured);
      if (isTraficomFiAutoActive(json.status) && !pollFrom.current) pollFrom.current = Date.now();
    } catch {
      /* nākamā aptauja */
    }
  }, [enabled, vin]);

  const post = useCallback(
    async (trigger: "auto" | "manual", force: boolean, reason: string) => {
      if (!enabled || !vin) return;
      setBusy(true);
      pollFrom.current = Date.now();
      try {
        const res = await fetch("/api/admin/vin-scan/traficom", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ vin, trigger, force, reason }),
        });
        const json = (await res.json().catch(() => null)) as { status?: TraficomFiAutoStatus; configured?: boolean } | null;
        if (json?.status) setStatus(json.status);
        if (typeof json?.configured === "boolean") setConfigured(json.configured);
      } catch {
        /* nākamreiz */
      } finally {
        setBusy(false);
        setTick((n) => n + 1);
      }
    },
    [enabled, vin],
  );

  useEffect(() => {
    setStatus(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !vin || !signal.start || autoTried.current === vin) return;
    autoTried.current = vin;
    // Serveris pats pārbauda, vai automātika ieslēgta un vai šim VIN jau prasīts.
    void post("auto", false, signal.reason);
  }, [enabled, vin, signal.start, signal.reason, post]);

  useEffect(() => {
    if (!isTraficomFiAutoActive(status) || !pollFrom.current || Date.now() - pollFrom.current > POLL_MAX_MS) return;
    const t = window.setTimeout(() => void load().finally(() => setTick((n) => n + 1)), POLL_MS);
    return () => window.clearTimeout(t);
  }, [status, tick, load]);

  const start = useCallback((force = true) => void post("manual", force, ""), [post]);
  return { status, configured, busy, start };
}

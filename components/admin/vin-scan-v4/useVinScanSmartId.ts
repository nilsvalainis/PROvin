"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { VinScanV4SmartId } from "@/components/admin/vin-scan-v4/AdminVinScanV4";
import type { EcsddAutoStatus } from "@/lib/ecsdd-auto-types";
import type { LtabAutoStatus } from "@/lib/ltab-auto-types";

const ACTIVE = new Set(["queued", "awaiting_login", "awaiting_smartid", "searching"]);
const POLL_MS = 4000;
/** Smart-ID gaidīšana nebeidzas mūžīgi - pēc 5 min aptur aptauju (stāvoklis paliek redzams). */
const POLL_MAX_MS = 5 * 60 * 1000;

type SmartIdResponse = {
  ecsdd: EcsddAutoStatus | null;
  ltab: LtabAutoStatus | null;
  ecsddConfigured: boolean;
  ltabConfigured: boolean;
  session: { state: string; verificationCode?: string } | null;
};

function isActive(d: SmartIdResponse | null): boolean {
  if (!d) return false;
  return ACTIVE.has(d.ecsdd?.state ?? "") || ACTIVE.has(d.ltab?.state ?? "") || d.session?.state === "awaiting_smartid";
}

/**
 * «Ātrā pārbaude»: e.csdd + LTAB caur servera Smart-ID sesiju (`/api/admin/vin-scan/smartid`, atsauce `vs_<vin>`).
 * `startNonce` > 0 maiņa = «Pārbaudīt» (POST sāk); citādi tikai nolasa iepriekšējo stāvokli.
 */
export function useVinScanSmartId({
  vin,
  plate,
  enabled,
  startNonce,
  force = false,
}: {
  vin: string;
  plate: string;
  enabled: boolean;
  startNonce: number;
  force?: boolean;
}): { state: VinScanV4SmartId | null; retry: () => void } {
  const [data, setData] = useState<SmartIdResponse | null>(null);
  const [busyStart, setBusyStart] = useState(false);
  const pollFrom = useRef(0);
  const [tick, setTick] = useState(0);

  const load = useCallback(
    async (method: "GET" | "POST", forceStart = false) => {
      if (!enabled || !vin) return;
      const qs = `vin=${encodeURIComponent(vin)}${plate ? `&plate=${encodeURIComponent(plate)}` : ""}`;
      try {
        const res =
          method === "GET"
            ? await fetch(`/api/admin/vin-scan/smartid?${qs}`, { credentials: "include", cache: "no-store" })
            : await fetch("/api/admin/vin-scan/smartid", {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ vin, plate, force: forceStart }),
              });
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as SmartIdResponse | null;
        if (json) setData(json);
      } catch {
        /* tīkla kļūda - nākamā aptauja */
      }
    },
    [enabled, vin, plate],
  );

  useEffect(() => {
    setData(null);
    if (enabled && vin) void load("GET");
  }, [enabled, vin, load]);

  useEffect(() => {
    if (!startNonce || !enabled || !vin) return;
    setBusyStart(true);
    pollFrom.current = Date.now();
    void load("POST", force).finally(() => {
      setBusyStart(false);
      setTick((n) => n + 1);
    });
    // startNonce ir vienīgais palaidējs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNonce]);

  useEffect(() => {
    if (!isActive(data) || !pollFrom.current || Date.now() - pollFrom.current > POLL_MAX_MS) return;
    const t = window.setTimeout(() => {
      void load("GET").finally(() => setTick((n) => n + 1));
    }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [data, tick, load]);

  const retry = useCallback(() => {
    pollFrom.current = Date.now();
    setBusyStart(true);
    void load("POST", true).finally(() => {
      setBusyStart(false);
      setTick((n) => n + 1);
    });
  }, [load]);

  if (!enabled || !vin) return { state: null, retry };
  return {
    state: {
      ecsdd: data?.ecsdd ?? null,
      ltab: data?.ltab ?? null,
      ecsddConfigured: data?.ecsddConfigured ?? true,
      ltabConfigured: data?.ltabConfigured ?? true,
      sessionCode: data?.session?.state === "awaiting_smartid" ? (data.session.verificationCode ?? "") : "",
      starting: busyStart,
      hasPlate: Boolean(plate),
    },
    retry,
  };
}

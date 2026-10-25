"use client";

import { useCallback, useState } from "react";
import type { WaybillStopTarget } from "@/lib/iriss-waybill-stop";

export function useWaybillStop(onDone?: () => void) {
  const [target, setTarget] = useState<WaybillStopTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback((next: WaybillStopTarget) => {
    setError(null);
    setTarget(next);
  }, []);

  const cancel = useCallback(() => {
    setTarget(null);
    setError(null);
  }, []);

  const confirm = useCallback(async () => {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/iriss-pavadzimes/${encodeURIComponent(target.id)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; alreadyQueued?: boolean } | null;
      if (!res.ok || !json?.ok) {
        setError(typeof json?.error === "string" ? json.error : "Neizdevās pārtraukt.");
        return;
      }
      setTarget(null);
      onDone?.();
    } catch {
      setError("Neizdevās pārtraukt.");
    } finally {
      setBusy(false);
    }
  }, [busy, onDone, target]);

  return { target, ask, cancel, confirm, busy, error };
}

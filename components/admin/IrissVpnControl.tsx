"use client";

import { useCallback, useEffect, useState } from "react";
import { ttrVpnStatusLabel, type TtrVpnStatus } from "@/lib/iriss-ttr-control";

const POLL_MS = 15_000;

/** "Man vajag VPN": serveris (CSDD automātika) atslēdz savu VPN, lai Nils var pieslēgties ar to pašu kontu. */
export function IrissVpnControl() {
  const [status, setStatus] = useState<TtrVpnStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/iriss/vpn", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; status?: TtrVpnStatus };
      if (data.ok && data.status) setStatus(data.status);
    } catch {
      /* nākamā pārbaude mēģinās vēlreiz */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  async function requestStop() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/iriss/vpn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = (await res.json()) as { ok?: boolean; status?: TtrVpnStatus; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Neizdevās.");
      if (data.status) setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neizdevās.");
    } finally {
      setBusy(false);
    }
  }

  const tone =
    status?.vpn === "up" || status?.stopPending ? "bg-[#FF9500]" : status?.vpn === "down" ? "bg-[#34C759]" : "bg-[#C7C7CC]";

  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <button
        type="button"
        disabled={busy}
        onClick={() => void requestStop()}
        className="inline-flex min-h-11 items-center rounded-full border border-[#E5E7EB] px-3 text-[13px] font-medium disabled:opacity-50"
      >
        Man vajag VPN
      </button>
      <span className="inline-flex items-center gap-1.5 text-[#6B7280]">
        <span aria-hidden className={`h-2 w-2 rounded-full ${tone}`} />
        {status ? ttrVpnStatusLabel(status) : "..."}
      </span>
      {error ? <span className="text-[#B91C1C]">{error}</span> : null}
    </div>
  );
}

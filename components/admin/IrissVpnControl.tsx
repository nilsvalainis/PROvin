"use client";

import { useCallback, useEffect, useState } from "react";
import { ttrVpnStatusLabel, type TtrVpnStatus } from "@/lib/iriss-ttr-control";

const POLL_MS = 15_000;

function vpnCardSub(status: TtrVpnStatus | null): string {
  if (!status) return "";
  if (status.stopPending) return "Pagaidi brīdi - pēc tam vari pieslēgties pats.";
  if (status.vpn === "up") return "Aivars šobrīd strādā CSDD sistēmā. Ja VPN vajag tev, spied pogu - serveris to atbrīvos.";
  if (status.vpn === "down") return "Serveris VPN nelieto - vari pieslēgties pats.";
  return "";
}

/**
 * "Man vajag VPN": serveris (CSDD automātika) atslēdz savu VPN, lai Nils var pieslēgties ar to pašu kontu.
 * variant="card": telefonā lapas apakšā liela kartīte ar pogu (makets ~/pz-mob-v2); datorā paliek "inline".
 */
export function IrissVpnControl({ variant = "inline" }: { variant?: "inline" | "card" } = {}) {
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

  if (variant === "card") {
    const sub = vpnCardSub(status);
    return (
      <section aria-label="VPN un serveris" className="rounded-2xl bg-[var(--s1,#fff)] p-3.5">
        <p className="flex items-center gap-2.5 text-[15px] font-semibold text-[var(--ink,#0b0c10)]">
          <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${tone}`} />
          {status ? ttrVpnStatusLabel(status) : "Pārbauda servera stāvokli..."}
        </p>
        {sub ? <p className="mb-3 ml-[22px] mt-1 text-[13px] leading-snug text-[var(--ink2,#5e636e)]">{sub}</p> : <div className="h-3" />}
        <button
          type="button"
          disabled={busy}
          onClick={() => void requestStop()}
          className="flex h-[60px] w-full items-center justify-center !rounded-[14px] bg-[var(--btn-dark-bg,#1f2430)] text-[18px] font-bold text-[var(--btn-dark-fg,#fff)] disabled:opacity-50"
        >
          Man vajag VPN
        </button>
        {error ? <p className="mt-2 text-[13px] text-[var(--bad,#c2362b)]">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <button
        type="button"
        disabled={busy}
        onClick={() => void requestStop()}
        className="inline-flex min-h-11 items-center rounded-full border border-[var(--iriss-line)] px-3 text-[13px] font-medium disabled:opacity-50"
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

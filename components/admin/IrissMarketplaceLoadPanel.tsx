"use client";

import { useEffect, useState } from "react";
import {
  marketplaceMissingExtraRangeMessage,
  marketplaceMissingFieldsMessage,
} from "@/lib/marketplace/query-from-order";
import type { MarketplacePlatform } from "@/lib/marketplace/types";

type EstimateResponse = {
  ok?: boolean;
  error?: string;
  queryReady?: boolean;
  missingFields?: string[];
  needsOneOfExtra?: boolean;
  tooBroadReason?: string;
  estimatedUsd?: number;
  monthlyUsedUsd?: number;
  monthlyCapUsd?: number;
  perRunCapUsd?: number;
  remainingMonthlyUsd?: number;
  allowed?: boolean;
  reason?: string;
  warning80?: boolean;
  tokenReady?: boolean;
  loadsEnabled?: boolean;
  providers?: Array<{
    id: string;
    platform: MarketplacePlatform;
    label: string;
    maxItems: number;
    maxUsd: number;
    configured: boolean;
    reason?: string;
  }>;
};

type LoadResponse = {
  ok?: boolean;
  error?: string;
  blocked?: boolean;
  added?: number;
  grouped?: number;
  estimatedUsd?: number;
  chargedUsd?: number;
  monthlyUsedUsd?: number;
  remainingMonthlyUsd?: number;
};

type StatusResponse = {
  lastAutoAt?: string;
  nextAutoAt?: string;
  intervalDays?: number;
  lastRun?: { chargedUsd?: number; monthUsd?: number } | null;
};

type UsageResponse = {
  spentUsd?: number;
  monthlyCapUsd?: number;
  lastChargedUsd?: number;
  lastMonthUsd?: number;
};

function formatLvDate(iso: string | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("lv-LV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Riga",
  });
}

const ALL_PLATFORMS: MarketplacePlatform[] = ["mobilede", "autoscout24"];

export function IrissMarketplaceLoadPanel({ orderId }: { orderId: string }) {
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [platforms, setPlatforms] = useState<MarketplacePlatform[]>(ALL_PLATFORMS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastLoadCost, setLastLoadCost] = useState<{ chargedUsd: number; monthlyUsedUsd: number } | null>(null);

  async function loadEstimate() {
    try {
      const res = await fetch(`/api/admin/iriss-marketplace/estimate?orderId=${encodeURIComponent(orderId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as EstimateResponse;
      setEstimate(body);
    } catch {
      setEstimate({ ok: false, error: "Neizdevās nolasīt cenas aprēķinu." });
    }
  }

  async function loadStatus() {
    try {
      const res = await fetch(`/api/admin/iriss-marketplace/status?orderId=${encodeURIComponent(orderId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as StatusResponse;
      setStatus(body);
    } catch {
      setStatus(null);
    }
  }

  async function loadUsage() {
    try {
      const res = await fetch("/api/admin/iriss-marketplace/usage", {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as UsageResponse;
      setUsage(body);
    } catch {
      setUsage(null);
    }
  }

  useEffect(() => {
    void loadEstimate();
    void loadStatus();
    void loadUsage();
  }, [orderId]);

  function toggle(platform: MarketplacePlatform) {
    setPlatforms((prev) => {
      if (prev.includes(platform)) {
        const next = prev.filter((p) => p !== platform);
        return next.length ? next : prev;
      }
      return [...prev, platform];
    });
  }

  async function loadNow() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/iriss-marketplace/load", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, platforms, explicit: true }),
      });
      const body = (await res.json().catch(() => ({}))) as LoadResponse;
      if (!res.ok || !body.ok) {
        setMsg(body.error || "Ielāde bloķēta.");
        setBusy(false);
        return;
      }
      const chargedUsd = body.chargedUsd ?? 0;
      const monthlyUsedUsd = body.monthlyUsedUsd ?? 0;
      setLastLoadCost({ chargedUsd, monthlyUsedUsd });
      setMsg(
        `Ielādēti ${body.added ?? 0} sludinājumi. Šī ielāde: ${chargedUsd.toFixed(2)} $. Mēneša kopsumma: ${monthlyUsedUsd.toFixed(2)} $.`,
      );
      await Promise.all([loadEstimate(), loadStatus(), loadUsage()]);
      setBusy(false);
    } catch {
      setMsg("Ielāde neizdevās.");
      setBusy(false);
    }
  }

  const missingFields = estimate?.missingFields ?? [];
  const extraMissing = Boolean(estimate?.needsOneOfExtra);
  const loadsOff = estimate?.loadsEnabled !== true;
  const queryReady = estimate?.queryReady !== false && missingFields.length === 0 && !extraMissing;
  const allowed = !loadsOff && estimate?.allowed !== false && queryReady;
  const maxUsd = estimate?.estimatedUsd ?? 0;
  const missingText = marketplaceMissingFieldsMessage(missingFields);
  const extraText = marketplaceMissingExtraRangeMessage(extraMissing);
  const disabledText = "Ielāde izslēgta (izmaksu kontrole)";
  const chargedUsd = lastLoadCost?.chargedUsd ?? status?.lastRun?.chargedUsd ?? usage?.lastChargedUsd ?? 0;
  const monthlyUsedUsd = lastLoadCost?.monthlyUsedUsd ?? status?.lastRun?.monthUsd ?? usage?.lastMonthUsd ?? usage?.spentUsd ?? estimate?.monthlyUsedUsd ?? 0;
  const monthlyCapUsd = usage?.monthlyCapUsd ?? estimate?.monthlyCapUsd ?? 4.5;

  return (
    <section className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3.5">
      <p className="text-[13px] font-semibold text-[#111827]">mobile.de un AutoScout24</p>
      <p className="mt-1 text-[12px] leading-snug text-[#6b7280]">
        Automātiska ielāde ik pa {status?.intervalDays ?? 3} dienām tikai jauniem sludinājumiem. Poga Ielādēt -
        manuāla ielāde tagad.
      </p>
      <p className="mt-1 text-[12px] text-[#374151]">
        Pēdējā automātiskā ielāde: {formatLvDate(status?.lastAutoAt) || "vēl nav"}
      </p>
      <p className="mt-0.5 text-[12px] text-[#374151]">
        Nākamā: {formatLvDate(status?.nextAutoAt) || "pēc cron"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALL_PLATFORMS.map((platform) => {
          const on = platforms.includes(platform);
          return (
            <button
              key={platform}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(platform)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                on ? "border-[#111827] bg-[#111827] text-white" : "border-[#e5e7eb] bg-[#f3f4f6] text-[#374151]"
              }`}
            >
              {platform === "mobilede" ? "mobile.de" : "AutoScout24"}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-[#374151]">
        Aprēķinātā maksimālā cena: {maxUsd.toFixed(2)} $ (griests {estimate?.perRunCapUsd?.toFixed(2) ?? "0.50"} $
        šai ielādei, {monthlyCapUsd.toFixed(2)} $ mēnesī).
      </p>
      <p className="mt-1 text-[12px] text-[#374151]">
        Šī ielāde: {chargedUsd.toFixed(2)} $ · mēneša kopsumma: {monthlyUsedUsd.toFixed(2)} $ / {monthlyCapUsd.toFixed(2)} $
      </p>
      {estimate?.warning80 ? (
        <p className="mt-1 text-[12px] text-amber-900">Mēneša budžets ir virs 80%.</p>
      ) : null}
      {loadsOff ? <p className="mt-1 text-[12px] text-[#991b1b]">{disabledText}</p> : null}
      {estimate?.reason && !loadsOff ? <p className="mt-1 text-[12px] text-[#991b1b]">{estimate.reason}</p> : null}
      {missingText ? <p className="mt-1 text-[12px] text-[#991b1b]">{missingText}</p> : null}
      {extraText ? <p className="mt-1 text-[12px] text-[#991b1b]">{extraText}</p> : null}
      <button
        type="button"
        disabled={busy || loadsOff || !allowed}
        onClick={() => void loadNow()}
        className="mt-3 inline-flex h-10 items-center justify-center rounded-[10px] border border-[#111827] bg-[#111827] px-3 text-[12.5px] font-semibold text-white disabled:opacity-40"
        title={loadsOff ? disabledText : missingText || extraText || undefined}
      >
        {loadsOff ? disabledText : busy ? "Ielādē…" : "Ielādēt"}
      </button>
      {msg ? <p className="mt-2 text-[12px] text-[#374151]">{msg}</p> : null}
    </section>
  );
}

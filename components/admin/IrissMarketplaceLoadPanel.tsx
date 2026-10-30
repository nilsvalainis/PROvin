"use client";

import { useEffect, useState } from "react";
import { IrissOverflowItem, IrissOverflowMenu } from "@/components/admin/IrissOverflowMenu";
import {
  MARKETPLACE_APIFY_AUTOSCOUT24_USD_PER_RESULT,
  MARKETPLACE_APIFY_MOBILEDE_USD_PER_RESULT,
  MARKETPLACE_APIFY_START_USD,
  formatMarketplaceUsd,
} from "@/lib/marketplace/cost-caps";
import {
  IRISS_LOAD_ASSUMPTIONS,
  IRISS_LOAD_BUSY,
  IRISS_LOAD_FAIL,
  formatIrissLoadConfirmButton,
  formatIrissLoadEstimateLine,
  formatIrissLoadMonthSpent,
  irissMarketplaceLoadTone,
} from "@/lib/iriss-marketplace-load-view";
import {
  marketplaceMissingExtraRangeMessage,
  marketplaceMissingFieldsMessage,
} from "@/lib/marketplace/query-from-order";
import { MARKETPLACE_RADAR_EXTRA_RANGE_MESSAGE } from "@/lib/marketplace/query-from-scan";
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

export function IrissMarketplaceLoadPanel({
  orderId,
  scanId,
  enabledPlatforms,
  onLoaded,
  onFixCriteria,
}: {
  orderId?: string;
  scanId?: string;
  enabledPlatforms?: MarketplacePlatform[];
  onLoaded?: () => void | Promise<void>;
  onFixCriteria?: () => void;
}) {
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [platforms, setPlatforms] = useState<MarketplacePlatform[]>(
    enabledPlatforms?.length ? enabledPlatforms : ALL_PLATFORMS,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastLoadCost, setLastLoadCost] = useState<{ chargedUsd: number; monthlyUsedUsd: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const ownerQuery = scanId
    ? `scanId=${encodeURIComponent(scanId)}`
    : `orderId=${encodeURIComponent(orderId ?? "")}`;
  const availablePlatforms = enabledPlatforms?.length ? enabledPlatforms : ALL_PLATFORMS;
  const radar = Boolean(scanId);

  async function loadEstimate() {
    try {
      const res = await fetch(`/api/admin/iriss-marketplace/estimate?${ownerQuery}`, {
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
      const res = await fetch(`/api/admin/iriss-marketplace/status?${ownerQuery}`, {
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
    setPlatforms((prev) => {
      const next = prev.filter((p) => availablePlatforms.includes(p));
      return next.length ? next : availablePlatforms;
    });
    void loadEstimate();
    void loadStatus();
    void loadUsage();
  }, [orderId, scanId, availablePlatforms.join("|")]);

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
        body: JSON.stringify({
          ...(scanId ? { scanId } : { orderId }),
          platforms,
          explicit: true,
        }),
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
        `Ielādēti ${body.added ?? 0} sludinājumi. Šī ielāde: ${formatMarketplaceUsd(chargedUsd)}. Mēneša kopsumma: ${formatMarketplaceUsd(monthlyUsedUsd)}.`,
      );
      await Promise.all([loadEstimate(), loadStatus(), loadUsage()]);
      await onLoaded?.();
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
  const extraText = radar
    ? extraMissing
      ? MARKETPLACE_RADAR_EXTRA_RANGE_MESSAGE
      : ""
    : marketplaceMissingExtraRangeMessage(extraMissing);
  const disabledText = "Ielāde izslēgta (izmaksu kontrole)";
  const monthlyUsedUsd = lastLoadCost?.monthlyUsedUsd ?? status?.lastRun?.monthUsd ?? usage?.lastMonthUsd ?? usage?.spentUsd ?? estimate?.monthlyUsedUsd ?? 0;
  const monthlyCapUsd = usage?.monthlyCapUsd ?? estimate?.monthlyCapUsd ?? 4.5;
  const perRunCapUsd = estimate?.perRunCapUsd ?? 0;
  const monthKey = new Date().toISOString().slice(0, 7);
  const tone = irissMarketplaceLoadTone({
    loadsOff,
    missing: Boolean(missingText || extraText),
    overLimit: !loadsOff && estimate?.allowed === false,
    warning80: Boolean(estimate?.warning80),
    busy,
    done: Boolean(lastLoadCost && !busy),
    error: Boolean(msg === IRISS_LOAD_FAIL || (msg && msg.includes("neizdevās"))),
  });
  const pct = monthlyCapUsd > 0 ? Math.min(100, (monthlyUsedUsd / monthlyCapUsd) * 100) : 0;
  const badge =
    tone === "off"
      ? disabledText
      : tone === "missing"
        ? missingText || extraText
        : tone === "limit"
          ? estimate?.reason || "Mēneša limits"
          : tone === "warn"
            ? "Virs 80%"
            : tone === "busy"
              ? IRISS_LOAD_BUSY
              : tone === "error"
                ? IRISS_LOAD_FAIL
                : tone === "done"
                  ? msg
                  : "Gatavs";

  return (
    <section className="rounded-[22px] bg-[var(--s1)] px-4 py-3.5 shadow-[var(--sh)]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-semibold text-[var(--ink)]">Tirgus ielāde</p>
        <div className="flex flex-wrap gap-1.5">
          {availablePlatforms.map((platform) => {
            const on = platforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(platform)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  on ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-fg)]" : "bg-[var(--fill)] text-[var(--ink2)]"
                }`}
              >
                {platform === "mobilede" ? "mobile.de" : "AutoScout24"}
              </button>
            );
          })}
        </div>
        {badge ? (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone === "warn" ? "font-bold text-[var(--ink)]" : "bg-[var(--fill)] text-[var(--ink2)]"}`}>
            {badge}
          </span>
        ) : null}
        <span className="ml-auto">
          <IrissOverflowMenu label="Vairāk">
            <IrissOverflowItem>
              {IRISS_LOAD_ASSUMPTIONS}: starts {formatMarketplaceUsd(MARKETPLACE_APIFY_START_USD)}, mobile.de{" "}
              {MARKETPLACE_APIFY_MOBILEDE_USD_PER_RESULT} $ / rezultāts, AutoScout24 {MARKETPLACE_APIFY_AUTOSCOUT24_USD_PER_RESULT}{" "}
              $ / rezultāts.
            </IrissOverflowItem>
          </IrissOverflowMenu>
        </span>
      </div>
      <p className="mt-2 text-[12px] text-[var(--ink2)]">
        Pēdējā: {formatLvDate(status?.lastAutoAt) || "vēl nav"} · Nākamā: {formatLvDate(status?.nextAutoAt) || "pēc cron"}
      </p>
      <p className="mt-1 text-[12px] text-[var(--ink2)]">
        {formatIrissLoadEstimateLine(maxUsd, perRunCapUsd)}
      </p>
      <p className={`mt-1 text-[12px] ${pct >= 80 ? "font-bold" : ""} text-[var(--ink)]`}>
        {formatIrissLoadMonthSpent(monthKey, monthlyUsedUsd, monthlyCapUsd)}
      </p>
      <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[var(--fill)]" aria-hidden>
        <div className="h-full bg-[var(--ink3)]" style={{ width: `${pct}%` }} />
      </div>
      {tone === "missing" && onFixCriteria ? (
        <button type="button" className="mt-2 text-[12px] font-semibold text-[var(--acc)]" onClick={onFixCriteria}>
          Labot kritērijus
        </button>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!allowed || loadsOff) return;
            setConfirmOpen(true);
          }}
          className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--chip-active-bg)] px-3.5 text-[13px] font-semibold text-[var(--chip-active-fg)] disabled:opacity-40"
        >
          {busy ? "Ielādē..." : "Ielādēt"}
        </button>
      </div>
      {radar ? (
        <p className="mt-2 text-[11px] text-[var(--ink3)]">
          Ielāde tikai ar pogu Ielādēt. Automātiska ielāde radarā nav. Mēneša griests {formatMarketplaceUsd(monthlyCapUsd)}.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--ink3)]">
          Automātiskās ielādes nav - ielādē ar pogu Ielādēt, kad vajag konkrētam pasūtījumam. Mēneša griests{" "}
          {formatMarketplaceUsd(monthlyCapUsd)}.
        </p>
      )}
      <p className="sr-only">
        Izmaksu pieņēmumi: starts {formatMarketplaceUsd(MARKETPLACE_APIFY_START_USD)}. mēneša kopsumma{" "}
        {formatMarketplaceUsd(monthlyUsedUsd)}.
      </p>
      {msg ? <p className="mt-2 text-[12px] text-[var(--ink2)]">{msg}</p> : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(20,24,35,0.2)] p-3 md:items-center" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-[22px] bg-[var(--s1)] p-4 shadow-[var(--gsh)]"
          >
            <p className="text-[15px] font-semibold text-[var(--ink)]">Apstiprināt ielādi</p>
            <p className="mt-2 text-[13px] text-[var(--ink2)]">{formatIrissLoadEstimateLine(maxUsd, perRunCapUsd)}</p>
            <p className="mt-1 text-[13px] text-[var(--ink2)]">
              {formatIrissLoadMonthSpent(monthKey, monthlyUsedUsd + maxUsd, monthlyCapUsd)}
            </p>
            {missingText ? <p className="mt-1 text-[13px] text-[var(--ink)]">{missingText}</p> : null}
            {extraText ? <p className="mt-1 text-[13px] text-[var(--ink)]">{extraText}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-[var(--fill)] text-[13px] font-semibold"
                onClick={() => setConfirmOpen(false)}
              >
                Atcelt
              </button>
              <button
                type="button"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-[var(--chip-active-bg)] text-[13px] font-semibold text-[var(--chip-active-fg)]"
                onClick={() => {
                  setConfirmOpen(false);
                  void loadNow();
                }}
              >
                {formatIrissLoadConfirmButton(maxUsd)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

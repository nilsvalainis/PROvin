import "server-only";

import { APIFY_API_BASE, readApifyToken } from "@/lib/marketplace/apify-client";
import { roundCostUsd, type CostSourceId } from "@/lib/admin-costs";

export type CostLiveFetch = {
  source: CostSourceId;
  usd: number;
  units: number;
  limitUsd: number | null;
  limitUnits: number | null;
  hard: boolean;
  fetchedAt: string;
  origin: "api";
  note?: string;
};

const FETCH_MS = 12_000;

function envNum(name: string, fallback: number): number {
  const raw = process.env[name]?.trim() ?? "";
  const n = raw ? Number.parseFloat(raw) : fallback;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function adminCostsEurToUsd(): number {
  return envNum("ADMIN_COSTS_EUR_TO_USD", 1.08);
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { headers, signal: ac.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Oficiāli: GET /v2/users/me/usage/monthly (lietojuma kopsavilkums, ne Actor palaišana). */
export async function fetchApifyMonthlyUsage(dateYmd: string): Promise<CostLiveFetch | null> {
  const token = readApifyToken();
  if (!token) return null;
  const url = new URL(`${APIFY_API_BASE}/users/me/usage/monthly`);
  if (dateYmd) url.searchParams.set("date", dateYmd);
  const raw = await fetchJson(url.toString(), { Authorization: `Bearer ${token}` });
  const data = asObj(asObj(raw)?.data) ?? asObj(raw);
  if (!data) return null;
  const usd = Number(data.totalUsageCreditsUsdAfterVolumeDiscount ?? data.totalUsageCreditsUsdBeforeVolumeDiscount ?? 0);
  return {
    source: "apify",
    usd: roundCostUsd(usd),
    units: 0,
    limitUsd: null,
    limitUnits: null,
    hard: true,
    fetchedAt: new Date().toISOString(),
    origin: "api",
  };
}

/** Oficiāli: GET /v2/users/me/limits. */
export async function fetchApifyAccountLimits(): Promise<{ limitUsd: number | null; usedUsd: number | null } | null> {
  const token = readApifyToken();
  if (!token) return null;
  const raw = await fetchJson(`${APIFY_API_BASE}/users/me/limits`, { Authorization: `Bearer ${token}` });
  const data = asObj(asObj(raw)?.data) ?? asObj(raw);
  if (!data) return null;
  const limits = asObj(data.limits);
  const current = asObj(data.current);
  const limitUsd = limits && typeof limits.maxMonthlyUsageUsd === "number" ? limits.maxMonthlyUsageUsd : null;
  const usedUsd = current && typeof current.monthlyUsageUsd === "number" ? current.monthlyUsageUsd : null;
  return { limitUsd, usedUsd };
}

function stripeMinorToUsd(fee: number, currency: string): number {
  const major = fee / 100;
  const cur = currency.toLowerCase();
  if (cur === "usd") return major;
  if (cur === "eur") return major * adminCostsEurToUsd();
  return major;
}

/**
 * Oficiāli: GET /v1/balance_transactions. Summē `fee` (lasīšana, ne jauns maksājums).
 * Dokumentācija: https://docs.stripe.com/api/balance_transactions/list
 */
export async function fetchStripeMonthFees(fromUnix: number, toUnix: number): Promise<CostLiveFetch | null> {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) return null;
  const { getStripe } = await import("@/lib/stripe");
  const stripe = getStripe();
  let usd = 0;
  let units = 0;
  let startingAfter: string | undefined;
  for (let page = 0; page < 40; page++) {
    const list = await stripe.balanceTransactions.list({
      limit: 100,
      created: { gte: fromUnix, lt: toUnix },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const txn of list.data) {
      const fee = typeof txn.fee === "number" ? txn.fee : 0;
      if (fee <= 0) continue;
      usd += stripeMinorToUsd(fee, txn.currency || "eur");
      units += 1;
    }
    if (!list.has_more || list.data.length === 0) break;
    startingAfter = list.data[list.data.length - 1]?.id;
    if (!startingAfter) break;
  }
  return {
    source: "stripe",
    usd: roundCostUsd(usd),
    units,
    limitUsd: null,
    limitUnits: null,
    hard: false,
    fetchedAt: new Date().toISOString(),
    origin: "api",
  };
}

/**
 * Oficiāli: GET /v1/billing/charges (FOCUS JSONL). Lasīšana, ne pirkums.
 * https://vercel.com/docs/rest-api/billing/list-focus-billing-charges
 */
export async function fetchVercelMonthCharges(fromIso: string, toIso: string): Promise<CostLiveFetch | null> {
  const token = (process.env.VERCEL_API_TOKEN ?? process.env.VERCEL_TOKEN ?? "").trim();
  if (!token) return null;
  const teamId = (process.env.VERCEL_TEAM_ID ?? "").trim();
  const url = new URL("https://api.vercel.com/v1/billing/charges");
  url.searchParams.set("from", fromIso);
  url.searchParams.set("to", toIso);
  if (teamId) url.searchParams.set("teamId", teamId);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/jsonl" },
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const text = await res.text();
    let usd = 0;
    let units = 0;
    for (const line of text.split(/\n+/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let row: Record<string, unknown>;
      try {
        row = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }
      const billed = Number(row.EffectiveCost ?? row.BilledCost ?? 0);
      if (Number.isFinite(billed)) usd += billed;
      units += 1;
    }
    return {
      source: "vercel",
      usd: roundCostUsd(usd),
      units,
      limitUsd: null,
      limitUnits: null,
      hard: false,
      fetchedAt: new Date().toISOString(),
      origin: "api",
    };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Oficiāli: GET /v1/organizations/cost_report. Vajag Admin API atslēgu, ne ANTHROPIC_API_KEY.
 * https://docs.anthropic.com/en/api/admin-api/usage-cost/get-cost-report
 */
export async function fetchAnthropicCostReport(startingAt: string, endingAt: string): Promise<CostLiveFetch | null> {
  const key = (process.env.ANTHROPIC_ADMIN_API_KEY ?? "").trim();
  if (!key) return null;
  const url = new URL("https://api.anthropic.com/v1/organizations/cost_report");
  url.searchParams.set("starting_at", startingAt);
  url.searchParams.set("ending_at", endingAt);
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");
  const raw = await fetchJson(url.toString(), {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  });
  const data = asObj(raw);
  const buckets = Array.isArray(data?.data) ? data.data : [];
  let cents = 0;
  for (const bucket of buckets) {
    const b = asObj(bucket);
    const results = Array.isArray(b?.results) ? b.results : [];
    for (const item of results) {
      const row = asObj(item);
      const amount = Number.parseFloat(String(row?.amount ?? "0"));
      if (Number.isFinite(amount)) cents += amount;
    }
  }
  return {
    source: "anthropic",
    usd: roundCostUsd(cents / 100),
    units: 0,
    limitUsd: null,
    limitUnits: null,
    hard: false,
    fetchedAt: new Date().toISOString(),
    origin: "api",
  };
}

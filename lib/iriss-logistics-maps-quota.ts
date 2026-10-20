import type { LogisticsMapsApi, LogisticsMapsUsageMonth } from "@/lib/iriss-logistics-types";

/** Google Maps Platform bezmaksas slieksnis, ko turam ar rezervi. */
export const LOGISTICS_MAPS_MONTHLY_CAP = 10_000;
/** ~10 000 / 31, lai viena diena neiztērē mēnesi. */
export const LOGISTICS_MAPS_DAILY_CAP = 320;

export const LOGISTICS_MAPS_LIMIT_NOTICE =
  "Google Maps mēneša limits ir sasniegts. Karte / ģeokodēšana šobrīd nav pieejama - limits atjaunosies nākamā mēneša 1. datumā.";

export const LOGISTICS_MAPS_DAILY_NOTICE =
  "Šodienas Google Maps limits (~320 izsaukumi) ir sasniegts. Mēģiniet rīt - mēneša kopējais limits paliek 10 000.";

export function logisticsMapsMonthKey(at = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function logisticsMapsDayKey(at = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  const d = String(at.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function emptyLogisticsMapsUsageMonth(month: string): LogisticsMapsUsageMonth {
  return { version: 1, month, mapsJs: 0, geocoding: 0, days: {} };
}

export function logisticsMapsUsed(usage: LogisticsMapsUsageMonth, api: LogisticsMapsApi): number {
  return api === "maps_js" ? usage.mapsJs : usage.geocoding;
}

export function logisticsMapsDayUsed(
  usage: LogisticsMapsUsageMonth,
  api: LogisticsMapsApi,
  day: string,
): number {
  const row = usage.days[day];
  if (!row) return 0;
  return api === "maps_js" ? row.mapsJs : row.geocoding;
}

export type LogisticsMapsQuotaDecision = {
  allowed: boolean;
  reason: string;
  notice: string;
  monthlyUsed: number;
  monthlyCap: number;
  dailyUsed: number;
  dailyCap: number;
  remainingMonthly: number;
  remainingDaily: number;
};

export function decideLogisticsMapsQuota(input: {
  usage: LogisticsMapsUsageMonth;
  api: LogisticsMapsApi;
  at?: Date;
  monthlyCap?: number;
  dailyCap?: number;
}): LogisticsMapsQuotaDecision {
  const at = input.at ?? new Date();
  const monthlyCap = input.monthlyCap ?? LOGISTICS_MAPS_MONTHLY_CAP;
  const dailyCap = input.dailyCap ?? LOGISTICS_MAPS_DAILY_CAP;
  const day = logisticsMapsDayKey(at);
  const monthlyUsed = logisticsMapsUsed(input.usage, input.api);
  const dailyUsed = logisticsMapsDayUsed(input.usage, input.api, day);
  const remainingMonthly = Math.max(0, monthlyCap - monthlyUsed);
  const remainingDaily = Math.max(0, dailyCap - dailyUsed);
  if (monthlyUsed >= monthlyCap) {
    return {
      allowed: false,
      reason: "monthly_cap",
      notice: LOGISTICS_MAPS_LIMIT_NOTICE,
      monthlyUsed,
      monthlyCap,
      dailyUsed,
      dailyCap,
      remainingMonthly,
      remainingDaily,
    };
  }
  if (dailyUsed >= dailyCap) {
    return {
      allowed: false,
      reason: "daily_cap",
      notice: LOGISTICS_MAPS_DAILY_NOTICE,
      monthlyUsed,
      monthlyCap,
      dailyUsed,
      dailyCap,
      remainingMonthly,
      remainingDaily,
    };
  }
  return {
    allowed: true,
    reason: "",
    notice: "",
    monthlyUsed,
    monthlyCap,
    dailyUsed,
    dailyCap,
    remainingMonthly,
    remainingDaily,
  };
}

export function incrementLogisticsMapsUsage(
  usage: LogisticsMapsUsageMonth,
  api: LogisticsMapsApi,
  at = new Date(),
): LogisticsMapsUsageMonth {
  const day = logisticsMapsDayKey(at);
  const prev = usage.days[day] ?? { mapsJs: 0, geocoding: 0 };
  const nextDay =
    api === "maps_js"
      ? { mapsJs: prev.mapsJs + 1, geocoding: prev.geocoding }
      : { mapsJs: prev.mapsJs, geocoding: prev.geocoding + 1 };
  return {
    ...usage,
    mapsJs: api === "maps_js" ? usage.mapsJs + 1 : usage.mapsJs,
    geocoding: api === "geocoding" ? usage.geocoding + 1 : usage.geocoding,
    days: { ...usage.days, [day]: nextDay },
  };
}

export function logisticsMapsUsageSummary(usage: LogisticsMapsUsageMonth, at = new Date()) {
  const mapsJs = decideLogisticsMapsQuota({ usage, api: "maps_js", at });
  const geocoding = decideLogisticsMapsQuota({ usage, api: "geocoding", at });
  return {
    month: usage.month,
    mapsJs: {
      monthlyUsed: mapsJs.monthlyUsed,
      monthlyCap: mapsJs.monthlyCap,
      dailyUsed: mapsJs.dailyUsed,
      dailyCap: mapsJs.dailyCap,
      remainingMonthly: mapsJs.remainingMonthly,
    },
    geocoding: {
      monthlyUsed: geocoding.monthlyUsed,
      monthlyCap: geocoding.monthlyCap,
      dailyUsed: geocoding.dailyUsed,
      dailyCap: geocoding.dailyCap,
      remainingMonthly: geocoding.remainingMonthly,
    },
  };
}

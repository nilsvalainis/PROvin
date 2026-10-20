import type { LogisticsMapsApi, LogisticsMapsDayUsage, LogisticsMapsUsageMonth } from "@/lib/iriss-logistics-types";

/** Google Maps Platform bezmaksas slieksnis, ko turam ar rezervi. */
export const LOGISTICS_MAPS_MONTHLY_CAP = 10_000;
/** ~10 000 / 31, lai viena diena neiztērē mēnesi. */
export const LOGISTICS_MAPS_DAILY_CAP = 320;

export const LOGISTICS_MAPS_LIMIT_NOTICE =
  "Google Maps mēneša limits ir sasniegts. Karte / ģeokodēšana šobrīd nav pieejama - limits atjaunosies nākamā mēneša 1. datumā.";

export const LOGISTICS_MAPS_DAILY_NOTICE =
  "Šodienas Google Maps limits (~320 izsaukumi) ir sasniegts. Mēģiniet rīt - mēneša kopējais limits paliek 10 000.";

export const LOGISTICS_GEOCODE_PLACE_URL = "https://geocode.googleapis.com/v4/geocode/places";
export const LOGISTICS_SEARCH_DESTINATIONS_URL = "https://geocode.googleapis.com/v4/geocode/destinations";

export const LOGISTICS_MAPS_API_FIELD: Record<LogisticsMapsApi, keyof LogisticsMapsDayUsage> = {
  maps_js: "mapsJs",
  geocoding: "geocoding",
  geocode_place: "geocodePlace",
  search_destinations: "searchDestinations",
};

export function emptyLogisticsMapsDayUsage(): LogisticsMapsDayUsage {
  return { mapsJs: 0, geocoding: 0, geocodePlace: 0, searchDestinations: 0 };
}

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
  return {
    version: 1,
    month,
    mapsJs: 0,
    geocoding: 0,
    geocodePlace: 0,
    searchDestinations: 0,
    days: {},
  };
}

export function logisticsMapsUsed(usage: LogisticsMapsUsageMonth, api: LogisticsMapsApi): number {
  return usage[LOGISTICS_MAPS_API_FIELD[api]];
}

export function logisticsMapsDayUsed(
  usage: LogisticsMapsUsageMonth,
  api: LogisticsMapsApi,
  day: string,
): number {
  const row = usage.days[day];
  if (!row) return 0;
  return row[LOGISTICS_MAPS_API_FIELD[api]] ?? 0;
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
  const field = LOGISTICS_MAPS_API_FIELD[api];
  const prev = { ...emptyLogisticsMapsDayUsage(), ...(usage.days[day] ?? {}) };
  const nextDay = { ...prev, [field]: (prev[field] ?? 0) + 1 };
  return {
    ...usage,
    mapsJs: usage.mapsJs ?? 0,
    geocoding: usage.geocoding ?? 0,
    geocodePlace: usage.geocodePlace ?? 0,
    searchDestinations: usage.searchDestinations ?? 0,
    [field]: (usage[field] ?? 0) + 1,
    days: { ...usage.days, [day]: nextDay },
  };
}

function apiSummary(usage: LogisticsMapsUsageMonth, api: LogisticsMapsApi, at: Date) {
  const d = decideLogisticsMapsQuota({ usage, api, at });
  return {
    monthlyUsed: d.monthlyUsed,
    monthlyCap: d.monthlyCap,
    dailyUsed: d.dailyUsed,
    dailyCap: d.dailyCap,
    remainingMonthly: d.remainingMonthly,
  };
}

export function logisticsMapsUsageSummary(usage: LogisticsMapsUsageMonth, at = new Date()) {
  return {
    month: usage.month,
    mapsJs: apiSummary(usage, "maps_js", at),
    geocoding: apiSummary(usage, "geocoding", at),
    geocodePlace: apiSummary(usage, "geocode_place", at),
    searchDestinations: apiSummary(usage, "search_destinations", at),
  };
}

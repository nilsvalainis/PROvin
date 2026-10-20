import { formatMarketplaceUsd } from "@/lib/marketplace/cost-caps";

export const IRISS_LIMITS_TITLE = "LIMITI";
export const IRISS_LIMITS_ADMIN_ONLY = "Tikai adminam";
export const IRISS_LIMITS_STALE = "Dati novecojuši";
export const IRISS_LIMITS_GEMINI_HREF = "https://aistudio.google.com";
export const IRISS_LIMITS_APIFY_HREF = "https://console.apify.com/billing";
export const IRISS_LIMITS_VERCEL_HREF = "https://vercel.com/dashboard";

export const IRISS_LIMITS_ROWS = [
  { id: "gemini", label: "Gemini", href: IRISS_LIMITS_GEMINI_HREF },
  { id: "apify", label: "Apify", href: IRISS_LIMITS_APIFY_HREF },
  { id: "vercel", label: "Vercel", href: IRISS_LIMITS_VERCEL_HREF },
] as const;

export type IrissLimitsRowId = (typeof IRISS_LIMITS_ROWS)[number]["id"];
export type IrissLimitsTone = "ok" | "warn" | "bad";

export function irissLimitsPercent(used: number, cap: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(cap) || cap <= 0) return 0;
  return Math.min(100, Math.max(0, (used / cap) * 100));
}

export function irissLimitsTone(percent: number): IrissLimitsTone {
  if (percent >= 95) return "bad";
  if (percent >= 80) return "warn";
  return "ok";
}

export function formatIrissLimitsSpend(used: number, cap: number): string {
  return `${formatMarketplaceUsd(used)} / ${formatMarketplaceUsd(cap)}`;
}

export function formatIrissLimitsPercent(percent: number): string {
  return `${Math.round(percent)}%`;
}

export function formatIrissLimitsRefreshed(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("lv-LV", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Riga",
  }).format(new Date(t));
}

export function irissLimitsIsStale(iso: string, nowMs = Date.now()): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return true;
  return nowMs - t > 26 * 60 * 60 * 1000;
}

export function irissLimitsWorstTone(tones: readonly IrissLimitsTone[]): IrissLimitsTone {
  if (tones.includes("bad")) return "bad";
  if (tones.includes("warn")) return "warn";
  return "ok";
}

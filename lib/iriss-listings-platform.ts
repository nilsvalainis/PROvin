import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

const HOSTS: Record<IrissListingPlatform, string[]> = {
  autobid: ["autobid.de", "autobid.eu"],
  openline: ["openlane.eu", "openlane.com", "openline.eu"],
  auto1: ["auto1.com", "auto1.eu", "auto1-group.com"],
  ecarstrade: ["ecarstrade.com"],
  mobilede: ["mobile.de"],
  autoscout24: ["autoscout24.de", "autoscout24.com", "autoscout24.at", "autoscout24.nl", "autoscout24.be"],
};

export const IRISS_LISTING_PLATFORM_LABEL: Record<IrissListingPlatform, string> = {
  autobid: "Autobid",
  openline: "Openlane",
  auto1: "Auto1",
  ecarstrade: "eCarsTrade",
  mobilede: "mobile.de",
  autoscout24: "AutoScout24",
};

/** Hosts -> platforma. Izsoļu cron joprojām izlaiž mobile.de / AutoScout24. */
export function detectIrissListingPlatform(url: string): IrissListingPlatform | null {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const platform of Object.keys(HOSTS) as IrissListingPlatform[]) {
    if (HOSTS[platform].some((h) => host === h || host.endsWith(`.${h}`))) return platform;
  }
  return null;
}

export function cleanHttpUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function isBlockedListingUrlIdentity(u: URL): boolean {
  if (u.username || u.password) return true;
  if (u.port && u.port !== "443" && u.port !== "80") return true;
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost")) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

/**
 * Nolasīšanas saite: zināma izsoļu platforma, https, bez lietotāja/paroles un bez IP hosta.
 * `http` tiek pacelts uz `https`, lai operatora ielīmējums nesalūztu.
 */
export function normalizeAllowedListingSourceUrl(raw: string): string | null {
  const cleaned = cleanHttpUrl(raw);
  if (!cleaned) return null;
  let u: URL;
  try {
    u = new URL(cleaned);
  } catch {
    return null;
  }
  if (u.protocol === "http:") u.protocol = "https:";
  if (u.protocol !== "https:") return null;
  if (isBlockedListingUrlIdentity(u)) return null;
  if (!detectIrissListingPlatform(u.toString())) return null;
  return u.toString();
}

export function isAllowedListingSourceUrl(raw: string): boolean {
  return normalizeAllowedListingSourceUrl(raw) !== null;
}

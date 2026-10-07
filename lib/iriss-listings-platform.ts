import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

const HOSTS: Record<IrissListingPlatform, string[]> = {
  autobid: ["autobid.de", "autobid.eu"],
  openline: ["openlane.eu", "openlane.com", "openline.eu"],
  auto1: ["auto1.com", "auto1.eu", "auto1-group.com"],
};

export const IRISS_LISTING_PLATFORM_LABEL: Record<IrissListingPlatform, string> = {
  autobid: "Autobid",
  openline: "Openlane",
  auto1: "Auto1",
};

/** Mobile.de un nezināmi hosti dod `null`: šajā fāzē tos nelasa. */
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

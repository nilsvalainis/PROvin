/**
 * IRISS Sludinājumi joslas tīrais teksts: avotu statuss, PVN skaiti, pieslēgumi.
 * Bez krāsainiem statusiem un bez env nosaukumiem.
 */

import type { IrissListingPlatformIngestStat } from "@/lib/iriss-listings-ingest-stats";
import type { IrissListingPlatform, IrissPlatformHealthItem } from "@/lib/iriss-listings-types";
import { isIrissMarketplaceListingPlatform } from "@/lib/iriss-listings-types";
import type { ListingVatHealth } from "@/lib/iriss-listings-vat";

export const LISTING_PLATFORM_LABEL: Record<IrissListingPlatform, string> = {
  autobid: "Autobid",
  openline: "Openlane",
  auto1: "Auto1",
  ecarstrade: "eCarsTrade",
  mobilede: "mobile.de",
  autoscout24: "AutoScout24",
};

export function listingFmtClock(iso: string, nowMs: number | null): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  if (nowMs == null) return "\u00a0";
  return new Intl.DateTimeFormat("lv-LV", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Riga",
  }).format(new Date(t));
}

export function listingFmtDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso || "";
  return new Intl.DateTimeFormat("lv-LV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Riga",
  }).format(new Date(t));
}

export function listingIngestRowStatus(stat: IrissListingPlatformIngestStat): {
  label: string;
  okText: string;
  autoText: string;
} {
  if (isIrissMarketplaceListingPlatform(stat.platform)) {
    return { label: "Tikai manuāli, maksas", okText: "-", autoText: "-" };
  }
  if (stat.sourceCount === 0) {
    return { label: "Nav saišu", okText: "-", autoText: String(stat.vehicleCount) };
  }
  const errors = Math.max(0, stat.sourceCount - stat.okCount);
  if (errors === 0) {
    return {
      label: "Strādā",
      okText: `${stat.okCount} / ${stat.sourceCount}`,
      autoText: String(stat.vehicleCount),
    };
  }
  return {
    label: `Daļēji, ${errors} kļūdas`,
    okText: `${stat.okCount} / ${stat.sourceCount}`,
    autoText: String(stat.vehicleCount),
  };
}

export function listingSourceStatusProse(input: {
  ingest: readonly IrissListingPlatformIngestStat[];
  vehicleCount: number;
  freshCount: number;
  priceCount: number;
  okSources: number;
  totalSources: number;
}): string {
  const auction = input.ingest.filter((s) => !isIrissMarketplaceListingPlatform(s.platform));
  let working = 0;
  let problems = 0;
  for (const s of auction) {
    const row = listingIngestRowStatus(s);
    if (row.label === "Strādā") working += 1;
    else if (row.label.startsWith("Daļēji")) problems += 1;
  }
  const parts: string[] = [];
  if (problems > 0) parts.push(`${working} avoti strādā, ${problems} ar problēmām.`);
  else parts.push(`${working} avoti strādā.`);
  const ect = input.ingest.find((s) => s.platform === "ecarstrade");
  if (ect && ect.sourceCount > 0) {
    parts.push(`${LISTING_PLATFORM_LABEL.ecarstrade} nolasīja ${ect.okCount} no ${ect.sourceCount} saitēm.`);
  }
  parts.push(
    `Kopā ${input.vehicleCount} auto, no tiem ${input.freshCount} jauni un ${input.priceCount} ar cenu izmaiņām.`,
  );
  if (input.totalSources > 0) {
    parts.push(`${input.okSources} no ${input.totalSources} saitēm nolasītas bez kļūdām.`);
  }
  parts.push("PVN režīms ikdienā redzams katrā kartītē.");
  return parts.join(" ");
}

export function listingVatNeedsCheck(h: ListingVatHealth): number {
  return h.stale + h.missingFields + h.rateMissing + h.conflict + h.defaultUnrecognised;
}

export function listingConnectionStatusLabel(status: IrissPlatformHealthItem["status"]): string {
  if (status === "ok") return "Pieslēgts";
  if (status === "stale") return "novecojis";
  if (status === "blocked_by_waf") return "bloķēts (403)";
  if (status === "login_required") return "jāielogojas no jauna";
  if (status === "relay_not_configured") return "relejs nav pieslēgts";
  if (status === "no_sources") return "nav saišu";
  if (status === "not_run") return "nav lasīts";
  return "neizdevās";
}

export function listingSourceRunStatusLabel(status: string): string {
  if (status === "ok") return "OK";
  if (status === "login_required") return "Jāielogojas";
  if (status === "blocked_by_waf") return "Bloķēts (403)";
  if (status === "parse_failed") return "Parse kļūda";
  if (status === "relay_not_configured") return "Relejs nav pieslēgts";
  if (status === "skipped") return "Izlaists";
  return "Nolasīšana neizdevās";
}

export function listingSyncProgressLabel(syncBusy: boolean, syncMsg: string | null): string | null {
  if (!syncBusy || !syncMsg) return null;
  const m = syncMsg.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? `${m[1]}/${m[2]}` : null;
}

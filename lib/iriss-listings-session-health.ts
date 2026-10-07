import "server-only";

import { readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import { fetchIrissRelayHealth, readIrissRelayConfig, relayPlatformFor, type IrissRelayHealth } from "@/lib/iriss-listings-relay";
import {
  IRISS_LISTING_PLATFORMS,
  type IrissListingPlatform,
  type IrissListingsLatestView,
  type IrissPlatformHealthItem,
  type IrissPlatformHealthReport,
  type IrissPlatformHealthStatus,
} from "@/lib/iriss-listings-types";

const STALE_AFTER_HOURS = 30;

function parseIsoSafe(v: string): number {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

export function platformHealthFromView(
  platform: IrissListingPlatform,
  latest: IrissListingsLatestView | null,
  checkedAt: string,
): IrissPlatformHealthItem {
  const base = { platform, checkedAt };
  const done = (status: IrissPlatformHealthStatus, note: string): IrissPlatformHealthItem => ({ ...base, status, note });

  if (!latest) return done("not_run", "Nolasīšana vēl nav veikta.");
  const sources = latest.sources.filter((s) => s.platform === platform);
  if (sources.length === 0) return done("no_sources", "Aktīvajos pasūtījumos nav šīs platformas saišu.");

  const has = (s: (typeof sources)[number]["status"]) => sources.some((x) => x.status === s);
  if (has("relay_not_configured")) return done("relay_not_configured", "Lasīšana caur Hetzner releju vēl nav pieslēgta (Fāze 1).");
  if (has("login_required")) return done("login_required", "Avots prasa pieslēgties no jauna. Jāatjauno sesija relejā.");
  if (has("blocked_by_waf")) return done("blocked_by_waf", "Avots bloķē pieprasījumus (HTTP 403 / 429).");
  const okCount = sources.filter((s) => s.status === "ok").length;
  if (okCount === 0) {
    const first = sources.find((s) => s.note)?.note ?? "";
    return done("failed", first ? `Neviens avots neizdevās. ${first}` : "Neviens avots neizdevās.");
  }
  const ageHours = (parseIsoSafe(checkedAt) - parseIsoSafe(latest.generatedAt)) / 36e5;
  if (ageHours > STALE_AFTER_HOURS) return done("stale", `Pēdējā nolasīšana pirms ${Math.round(ageHours)} h.`);
  if (okCount < sources.length) return done("ok", `${okCount}/${sources.length} avoti nolasīti.`);
  return done("ok", `${okCount}/${sources.length} avoti nolasīti.`);
}

/**
 * Releja live sesijas stāvoklis pārraksta vēsturisko ainu: ja relejs saka, ka sesija beigusies, UI jārāda
 * "jāielogojas no jauna" arī tad, ja rīta nolasīšana vēl bija ok. Autobid: tikai ja lasa caur releju.
 */
export function mergeRelayHealth(
  item: IrissPlatformHealthItem,
  relay: IrissRelayHealth | null,
  opts: { autobidViaRelay: boolean },
): IrissPlatformHealthItem {
  if (!relay) return item;
  if (item.platform === "autobid" && !opts.autobidViaRelay) return item;
  if (!relay.reachable) {
    if (item.status === "no_sources") return item;
    return { ...item, status: "failed", note: `${relay.note} ${item.note}`.trim() };
  }
  const p = relay.platforms[relayPlatformFor(item.platform)];
  if (!p) return item;
  if (item.status === "relay_not_configured") {
    return { ...item, status: p.session === "login_required" ? "login_required" : "not_run", note: p.session === "login_required" ? "Relejs: sesija beigusies, jāielogojas no jauna." : "Relejs pieslēgts, nolasīšana vēl nav veikta." };
  }
  if (p.session === "login_required" && item.status !== "no_sources") {
    return { ...item, status: "login_required", note: "Relejs: sesija beigusies, jāielogojas no jauna." };
  }
  if (p.session === "ok" && item.status === "login_required") {
    return { ...item, status: "ok", note: `Relejs: sesija atjaunota. ${item.note}`.trim() };
  }
  return item;
}

export async function getIrissPlatformHealthReport(): Promise<IrissPlatformHealthReport> {
  const checkedAt = new Date().toISOString();
  const cfg = readIrissRelayConfig();
  const [latest, relay] = await Promise.all([readIrissListingsLatestView(), cfg ? fetchIrissRelayHealth(cfg) : Promise.resolve(null)]);
  const autobidViaRelay = /^(1|true|yes)$/i.test(process.env.IRISS_LISTINGS_AUTOBID_VIA_RELAY ?? "");
  return {
    checkedAt,
    items: IRISS_LISTING_PLATFORMS.map((platform) => mergeRelayHealth(platformHealthFromView(platform, latest, checkedAt), relay, { autobidViaRelay })),
  };
}

import "server-only";

import { readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
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

export async function getIrissPlatformHealthReport(): Promise<IrissPlatformHealthReport> {
  const checkedAt = new Date().toISOString();
  const latest = await readIrissListingsLatestView();
  return {
    checkedAt,
    items: IRISS_LISTING_PLATFORMS.map((platform) => platformHealthFromView(platform, latest, checkedAt)),
  };
}

import "server-only";

import { readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import type {
  IrissSessionHealthItem,
  IrissSessionHealthReport,
  IrissSessionHealthStatus,
} from "@/lib/iriss-listings-types";

const PLATFORMS = ["mobile", "autobid", "openline", "auto1"] as const;
type Platform = (typeof PLATFORMS)[number];

function hasAuthConfig(platform: Platform): boolean {
  const pfx = `IRISS_LISTINGS_${platform.toUpperCase()}`;
  const auth = process.env[`${pfx}_AUTH_HEADER`]?.trim() ?? "";
  const cookie = process.env[`${pfx}_COOKIE`]?.trim() ?? "";
  return Boolean(auth || cookie);
}

function parseIsoSafe(v: string): number {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function statusForPlatform(
  platform: Platform,
  latest: Awaited<ReturnType<typeof readIrissListingsLatestView>>,
  checkedAt: string,
): IrissSessionHealthItem {
  const items = (latest?.items ?? []).filter((x) => x.sourcePlatform === platform);
  const configured = hasAuthConfig(platform);
  const hasLoginRequired = items.some((x) => x.status === "login_required");
  const hasOk = items.some((x) => x.status === "ok");

  let status: IrissSessionHealthStatus = "ok";
  let note = "Sesija izskatās stabila.";

  if (!configured) {
    status = "login_required";
    note = "Nav iestatīts AUTH_HEADER/COOKIE šai platformai.";
  } else if (hasLoginRequired) {
    status = "login_required";
    note = "Pēdējā nolasīšanā avots pieprasīja login.";
  } else if (!hasOk && items.length > 0) {
    status = "expiring_soon";
    note = "Pēdējā nolasīšanā nebija veiksmīgu ierakstu.";
  } else if (items.length === 0) {
    status = "expiring_soon";
    note = "Šobrīd nav nolasītu ierakstu šai platformai.";
  } else {
    const newestMs = Math.max(...items.map((x) => parseIsoSafe(x.aggregatedAt)));
    const ageHours = (parseIsoSafe(checkedAt) - newestMs) / 36e5;
    if (ageHours > 18) {
      status = "expiring_soon";
      note = "Pēdējā veiksmīgā nolasīšana ir novecojusi (>18h).";
    }
  }

  return {
    platform,
    status,
    note,
    checkedAt,
  };
}

export async function getIrissSessionHealthReport(): Promise<IrissSessionHealthReport> {
  const checkedAt = new Date().toISOString();
  const latest = await readIrissListingsLatestView();
  const items = PLATFORMS.map((platform) => statusForPlatform(platform, latest, checkedAt));
  return { checkedAt, items };
}

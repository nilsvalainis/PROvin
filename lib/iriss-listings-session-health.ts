import "server-only";

import { readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import { hasUsableMobilePersistentProfile } from "@/lib/iriss-listings-mobile-persistent-fetch";
import { getSessionFileMeta } from "@/lib/iriss-listings-session-auth";
import type {
  IrissSessionHealthItem,
  IrissSessionHealthReport,
  IrissSessionHealthStatus,
} from "@/lib/iriss-listings-types";

const PLATFORMS = ["mobile", "autobid", "openline", "auto1"] as const;
type Platform = (typeof PLATFORMS)[number];

async function hasAuthConfig(platform: Platform): Promise<boolean> {
  if (platform === "mobile" && (await hasUsableMobilePersistentProfile())) return true;
  const pfx = `IRISS_LISTINGS_${platform.toUpperCase()}`;
  const auth = process.env[`${pfx}_AUTH_HEADER`]?.trim() ?? "";
  const cookie = process.env[`${pfx}_COOKIE`]?.trim() ?? "";
  const loginUrl = process.env[`${pfx}_LOGIN_URL`]?.trim() ?? "";
  const username = process.env[`${pfx}_LOGIN_USERNAME`]?.trim() ?? "";
  const password = process.env[`${pfx}_LOGIN_PASSWORD`] ?? "";
  return Boolean(auth || cookie || (loginUrl && username && password));
}

function parseIsoSafe(v: string): number {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function statusForPlatform(
  platform: Platform,
  latest: Awaited<ReturnType<typeof readIrissListingsLatestView>>,
  sessionMeta: Awaited<ReturnType<typeof getSessionFileMeta>>,
  checkedAt: string,
  configured: boolean,
): IrissSessionHealthItem {
  const items = (latest?.items ?? []).filter((x) => x.sourcePlatform === platform);
  const hasLoginRequired = items.some((x) => x.status === "login_required");
  const hasOk = items.some((x) => x.status === "ok");

  let status: IrissSessionHealthStatus = "ok";
  let note = "Sesija izskatās stabila.";

  if (!configured) {
    status = "login_required";
    note =
      platform === "mobile"
        ? "Nav Mobile.de sesijas: izveido `.data/browser-profiles/mobile` ar `npm run auth:persistent-mobile` vai iestatiet COOKIE / LOGIN_*."
        : "Nav iestatīts AUTH_HEADER/COOKIE vai LOGIN_* parametri šai platformai.";
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
  if (sessionMeta && status !== "login_required") {
    const expiryMs = parseIsoSafe(sessionMeta.expiresAt);
    if (expiryMs > 0) {
      const remainingHours = (expiryMs - parseIsoSafe(checkedAt)) / 36e5;
      if (remainingHours <= 0) {
        status = "login_required";
        note = "Saglabātā sesija ir beigusies.";
      } else if (remainingHours < 12 && status === "ok") {
        status = "expiring_soon";
        note = `Sesija drīz beigsies (~${Math.max(1, Math.round(remainingHours))}h).`;
      }
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
  const items = await Promise.all(
    PLATFORMS.map(async (platform) => {
      const configured = await hasAuthConfig(platform);
      return statusForPlatform(platform, latest, await getSessionFileMeta(platform), checkedAt, configured);
    }),
  );
  return { checkedAt, items };
}

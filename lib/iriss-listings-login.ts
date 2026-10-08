import "server-only";

/**
 * Admin ielogošanās Openlane / Auto1 / Autobid caur Hetzner releja noVNC.
 * Paroles un 2FA kodus ievada īpašnieks attālinātajā pārlūkā; tās netiek sūtītas uz Vercel un netiek glabātas.
 * Pēc aizvēršanas paliek tikai Chrome profila sesija relejā + īsa pārbaude.
 */

import { readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import {
  checkIrissRelaySession,
  closeIrissRelayLogin,
  fetchViaIrissRelay,
  readIrissRelayConfig,
  relayPlatformFor,
  startIrissRelayLogin,
  type IrissRelayConfig,
} from "@/lib/iriss-listings-relay";
import type { IrissListingPlatform, IrissListingsLatestView } from "@/lib/iriss-listings-types";
import { IRISS_LISTING_PLATFORMS } from "@/lib/iriss-listings-types";

export type IrissLoginAction = "start" | "close" | "verify";

export type IrissLoginRequest = {
  platform: IrissListingPlatform;
  action: IrissLoginAction;
};

/** Publiskie probe URL, ja pasūtījumos nav šīs platformas saites. Hosts der releja validācijai. */
export const IRISS_LOGIN_PROBE_SOURCE: Record<IrissListingPlatform, string> = {
  openline: "https://www.openlane.eu/en/findcar",
  auto1: "https://www.auto1.com/en/app/merchant/cars?channel=24h&page=1",
  autobid: "https://autobid.de/en/search-results",
};

export function parseIrissLoginRequest(body: unknown): IrissLoginRequest | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { error: "Nederīgs pieprasījums." };
  const rec = body as Record<string, unknown>;
  const platform = typeof rec.platform === "string" ? rec.platform.trim() : "";
  const action = typeof rec.action === "string" ? rec.action.trim() : "";
  if (!IRISS_LISTING_PLATFORMS.includes(platform as IrissListingPlatform)) {
    return { error: "platform: openline | auto1 | autobid" };
  }
  if (action !== "start" && action !== "close" && action !== "verify") {
    return { error: "action: start | close | verify" };
  }
  return { platform: platform as IrissListingPlatform, action };
}

export function pickTestReadSource(
  latest: IrissListingsLatestView | null,
  platform: IrissListingPlatform,
): { platform: IrissListingPlatform; sourceUrl: string; orderId: string; orderBrandModel: string } {
  const hit = latest?.sources.find((s) => s.platform === platform && s.sourceUrl.startsWith("https://"));
  if (hit) {
    return { platform, sourceUrl: hit.sourceUrl, orderId: hit.orderId, orderBrandModel: hit.orderBrandModel || hit.orderId };
  }
  return { platform, sourceUrl: IRISS_LOGIN_PROBE_SOURCE[platform], orderId: "login-test", orderBrandModel: "sesijas pārbaude" };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type IrissLoginHandlerDeps = {
  cfg?: IrissRelayConfig | null;
  latest?: IrissListingsLatestView | null;
  fetchImpl?: FetchLike;
};

export async function handleIrissListingsLogin(
  req: IrissLoginRequest,
  deps: IrissLoginHandlerDeps = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const cfg = deps.cfg !== undefined ? deps.cfg : readIrissRelayConfig();
  if (!cfg) {
    return {
      status: 503,
      body: { error: "Relejs nav pieslēgts. Vajag IRISS_LISTINGS_RELAY_URL un IRISS_LISTINGS_RELAY_TOKEN." },
    };
  }
  const platform = relayPlatformFor(req.platform);
  const fetchOpts = deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {};

  if (req.action === "start") {
    const started = await startIrissRelayLogin(cfg, platform, fetchOpts);
    if (!started.ok) {
      return { status: 502, body: { error: started.note || "Ielogošanos neizdevās sākt." } };
    }
    return {
      status: 200,
      body: {
        ok: true,
        action: "start",
        platform: req.platform,
        vncUrl: started.vncUrl,
        vncReady: started.vncReady,
        vncError: started.vncError,
        minutes: started.minutes,
        startedAt: started.startedAt,
        reused: started.reused,
        note: started.vncReady
          ? "Atveras servera pārlūks. Ieraksti paroli un 2FA kodu pats. Paroli nesaglabājam."
          : started.vncError || "Attālinātais pārlūks nenostrādāja.",
      },
    };
  }

  if (req.action === "close") {
    const closed = await closeIrissRelayLogin(cfg, platform, fetchOpts);
    if (!closed.ok && /nav atvērta/i.test(closed.note)) {
      const verified = await verifyAfterLogin(cfg, req.platform, deps);
      return { status: 200, body: { ...verified, action: "close", platform: req.platform, closed: false } };
    }
    if (!closed.ok) {
      return { status: 502, body: { error: closed.note || "Ielogošanos neizdevās aizvērt." } };
    }
    const verified = await verifyAfterLogin(cfg, req.platform, deps);
    return {
      status: 200,
      body: {
        ...verified,
        action: "close",
        platform: req.platform,
        closed: true,
        loggedIn: closed.loggedIn,
      },
    };
  }

  const verified = await verifyAfterLogin(cfg, req.platform, deps);
  return { status: 200, body: { ...verified, action: "verify", platform: req.platform } };
}

async function verifyAfterLogin(cfg: IrissRelayConfig, platform: IrissListingPlatform, deps: IrissLoginHandlerDeps) {
  const fetchOpts = deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {};
  const check = await checkIrissRelaySession(cfg, relayPlatformFor(platform), fetchOpts);
  if (!check.ok) {
    return {
      ok: false,
      session: check.status,
      note: check.note || "Sesija joprojām nav aktīva. Ielogojies vēlreiz un tad spied Gatavs.",
      testRead: null as null,
    };
  }
  const latest = deps.latest !== undefined ? deps.latest : await readIrissListingsLatestView();
  const src = pickTestReadSource(latest, platform);
  const test = await fetchViaIrissRelay(cfg, src, { ...fetchOpts, maxPages: 1 });
  const testOk = test.status === "ok";
  return {
    ok: testOk,
    session: testOk ? "ok" : test.status,
    note: testOk
      ? `Sesija ir kārtībā. Pārbaude nolasīja ${test.vehicles.length} auto.`
      : `Sesija izskatās aktīva, bet testa nolasījums: ${test.note || test.status}`,
    testRead: { status: test.status, vehicleCount: test.vehicles.length, note: test.note },
  };
}

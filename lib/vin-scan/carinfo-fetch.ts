import "server-only";

/**
 * car.info viena adrese: tiešs fetch no servera, un ja tas ir bloķēts (Vercel IP dabū nginx 403),
 * tad Hetzner relejs. VIN/numura HTML lapa iet caur Chrome `/listings/page`, super-search JSON
 * pa plain HTTP `/listings/http` (Chrome page.goto JSON adresei gaida ~52 s un atdod 403).
 * Kopīgs VIN SCAN zondei un pasūtījuma avota blokam, lai abi lasa pa vienu un to pašu ceļu.
 */
import {
  CARINFO_SUPER_SEARCH_DIRECT_MS,
  CARINFO_SUPER_SEARCH_RELAY_MS,
  carinfoResponseBlocked,
  type CarinfoPageResponse,
} from "@/lib/vin-scan/carinfo-lookup";
import { scanFetch } from "@/lib/vin-scan/http";
import {
  applyCarinfoSuperSearchHttp,
  applyVinScanRelayIfBlocked,
  isCarinfoSuperSearchUrl,
} from "@/lib/vin-scan/listings-page-relay";

export type CarinfoFetchTrace = {
  /** Releja īstais iemesls (dienas limits, rinda pilna, tokens), ja relejs nepalīdzēja. */
  relayReason: string;
};

export async function fetchCarinfoPage(url: string, trace?: CarinfoFetchTrace): Promise<CarinfoPageResponse> {
  const superSearch = isCarinfoSuperSearchUrl(url);
  let direct: { status: number; text: string; cookie: string };
  try {
    const fetched = await scanFetch(url, {
      headers: {
        accept: superSearch ? "application/json, text/javascript, */*; q=0.01" : "text/html,application/xhtml+xml",
        referer: "https://www.car.info/en-se/",
        ...(superSearch ? { "x-requested-with": "XMLHttpRequest" } : {}),
      },
      timeoutMs: superSearch ? CARINFO_SUPER_SEARCH_DIRECT_MS : 12_000,
    });
    direct = { status: fetched.status, text: fetched.text, cookie: fetched.cookie ?? "" };
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "timeout") throw e;
    direct = { status: 0, text: "", cookie: "" };
  }
  if (!carinfoResponseBlocked(direct.status, direct.text)) {
    return { status: direct.status, text: direct.text };
  }
  const relayed = superSearch
    ? await applyCarinfoSuperSearchHttp(url, direct, { timeoutMs: CARINFO_SUPER_SEARCH_RELAY_MS })
    : await applyVinScanRelayIfBlocked(url, direct);
  const reason = String((relayed as { challengeReason?: string }).challengeReason ?? "").trim();
  if (reason && trace) trace.relayReason = reason;
  const relayDiffers = relayed.status !== direct.status || relayed.text !== direct.text;
  if (relayed.text && relayDiffers && !carinfoResponseBlocked(relayed.status, relayed.text)) {
    return { status: relayed.status, text: relayed.text };
  }
  return { status: direct.status, text: direct.text };
}

import "server-only";

import type { IrissAuctionLink } from "@/lib/iriss-auction-link";
import { mapRelayDetailResponse, type IrissRelayAuctionDetail } from "@/lib/iriss-auction-detail";
import { readIrissRelayConfig, relayPlatformFor } from "@/lib/iriss-listings-relay";

/** j56 B: viena detaļu lapa caur Hetzner releju (tā pati ielogotā sesija, ko lieto IRISS Saraksti). */
export async function fetchIrissAuctionDetailViaRelay(
  link: IrissAuctionLink,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<{ ok: true; detail: IrissRelayAuctionDetail } | { ok: false; error: string; note: string }> {
  const cfg = readIrissRelayConfig();
  if (!cfg) return { ok: false, error: "relay_not_configured", note: "Relejs nav konfigurēts - aizpildi ar roku." };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 150_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/detail`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ platform: relayPlatformFor(link.platform === "openline" ? "openline" : "auto1"), url: link.url }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    return mapRelayDetailResponse(res.status, body);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "relay_timeout" : "relay_unreachable",
      note: aborted ? "Izsoles lapa netika nolasīta laikā - aizpildi ar roku." : "Relejs nav sasniedzams - aizpildi ar roku.",
    };
  } finally {
    clearTimeout(timer);
  }
}

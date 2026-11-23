import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fetchVinSourceViaRelay, vinScanParseFromVinSource } from "@/lib/vin-scan/vinsource-relay";

const ENV = {
  IRISS_LISTINGS_RELAY_URL: "https://csdd-relay.provin.lv/listings",
  IRISS_LISTINGS_RELAY_TOKEN: "t0ken-t0ken-t0ken-t0ken",
};
const VIN = "WBA5R1C0XLFH42873";

function reply(status: number, body: unknown) {
  return async (url: string, init?: RequestInit) => {
    expect(url).toBe("https://csdd-relay.provin.lv/listings/vinsource");
    expect(JSON.parse(String(init?.body))).toEqual({ source: "bid_cars", vin: VIN });
    return new Response(JSON.stringify(body), { status });
  };
}

describe("releja /vinsource klients", () => {
  it("bid.cars found: lota HTML -> VIN SCAN rinda ar izsoli un bildēm", async () => {
    const html = readFileSync(path.join(__dirname, "__fixtures__", "bidcars", `lot-${VIN}.html`), "utf8");
    const lotUrl = "https://bid.cars/en/lot/0-27382814/2020-BMW-3-Series-WBA5R1C0XLFH42873";
    const got = await fetchVinSourceViaRelay("bid_cars", VIN, {
      env: ENV,
      fetchImpl: reply(200, { ok: true, kind: "found", html, finalUrl: lotUrl, search: { results: 1, lotUrl } }),
    });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    const p = vinScanParseFromVinSource("bid_cars", VIN, got, "https://bid.cars/en/search?q=x")!;
    expect(p.status).toBe("found");
    expect(p.openUrl).toBe(lotUrl);
    expect(p.auctions?.[0]?.photoCount).toBe(10);
  });

  it("bid.cars none -> «Nav izsoles arhīvā»", async () => {
    const got = await fetchVinSourceViaRelay("bid_cars", VIN, { env: ENV, fetchImpl: reply(200, { ok: true, kind: "none", search: { results: 0 } }) });
    expect(got.ok && vinScanParseFromVinSource("bid_cars", VIN, got, "u")).toMatchObject({ status: "none" });
  });

  it("blocked/error/vecs relejs -> ok:false ar iemeslu (pārlūka josla paliek)", async () => {
    const blocked = await fetchVinSourceViaRelay("bid_cars", VIN, {
      env: ENV,
      fetchImpl: reply(200, { ok: true, kind: "blocked", note: "bid.cars: Cloudflare izaicinājums nenokrita" }),
    });
    expect(blocked).toEqual({ ok: false, reason: "bid.cars: Cloudflare izaicinājums nenokrita" });
    const old = await fetchVinSourceViaRelay("bid_cars", VIN, { env: ENV, fetchImpl: reply(404, { ok: false, error: "nav" }) });
    expect(old).toEqual({ ok: false, reason: "Relejā vēl nav /vinsource (vajag releja deploy)" });
    const limit = await fetchVinSourceViaRelay("bid_cars", VIN, { env: ENV, fetchImpl: reply(429, { ok: false, error: "dienas limits 400" }) });
    expect(limit).toEqual({ ok: false, reason: "dienas limits 400" });
    expect(await fetchVinSourceViaRelay("bid_cars", VIN, { env: {} })).toEqual({ ok: false, reason: "Relejs nav konfigurēts" });
  });

  it("found ar svešu lapu -> null (nepieņem)", () => {
    expect(
      vinScanParseFromVinSource("bid_cars", VIN, { ok: true, kind: "found", html: "<html><title>x</title></html>", cached: false }, "u"),
    ).toBeNull();
  });
});

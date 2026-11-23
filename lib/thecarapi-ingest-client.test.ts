import { describe, expect, it } from "vitest";

import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { runThecarapiIngest, THECARAPI_TIMEOUT_ERROR_LV } from "@/lib/thecarapi-ingest-client";

const VIN = "WAUZZZF43PA018831";

type Call = { url: string; method: string; body: Record<string, unknown> | null };

function fake(responses: Array<Response | Error>): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null,
    });
    const next = queue.shift();
    if (!next) throw new Error("unexpected_fetch");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("runThecarapiIngest", () => {
  it("504 (ne-JSON) -> GET kešs svaigs -> cacheOnly POST -> dati blokā", async () => {
    const start = Date.parse("2026-11-22T23:45:43.000Z");
    const block = { ...emptyCcVinBlock(), aiContextRaw: "no-keša" };
    const { fetchImpl, calls } = fake([
      new Response("An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT", { status: 504 }),
      json(200, { enabled: true, cache: { cachedAt: "2026-11-22T23:46:43.000Z", summary: "BCA/Openlane, 2026, 2 ieraksti" } }),
      json(200, { ok: true, summary: "BCA/Openlane, 2026, 2 ieraksti", block, fromCache: true, cachedAt: "2026-11-22T23:46:43.000Z" }),
    ]);
    const out = await runThecarapiIngest({ vin: VIN, block: emptyCcVinBlock(), skipCache: true, fetchImpl, now: () => start });
    expect(out.recovered).toBe(true);
    expect(out.timedOut).toBe(true);
    expect(out.body.block?.aiContextRaw).toBe("no-keša");
    expect(calls.map((c) => c.method)).toEqual(["POST", "GET", "POST"]);
    expect(calls[1]?.url).toContain(`vin=${VIN}`);
    expect(calls[2]?.body).toMatchObject({ vin: VIN, cacheOnly: true, skipCache: false });
  });

  it("tīkla kļūda un vecs kešs -> konkrēts taimauta teksts, cacheOnly nesauc", async () => {
    const start = Date.parse("2026-11-22T23:45:43.000Z");
    const { fetchImpl, calls } = fake([
      new TypeError("Failed to fetch"),
      json(200, { enabled: true, cache: { cachedAt: "2026-11-01T10:00:00.000Z", summary: "vecs" } }),
    ]);
    const out = await runThecarapiIngest({ vin: VIN, block: emptyCcVinBlock(), skipCache: true, fetchImpl, now: () => start });
    expect(out.recovered).toBe(false);
    expect(out.body.error).toBe("timeout");
    expect(out.body.summary).toBe(THECARAPI_TIMEOUT_ERROR_LV);
    expect(calls).toHaveLength(2);
  });

  it("parasta JSON kļūda (502 ar summary) netiek atjaunota no keša", async () => {
    const { fetchImpl, calls } = fake([json(502, { error: "upstream_error", summary: "TheCarApi kļūda" })]);
    const out = await runThecarapiIngest({ vin: VIN, block: emptyCcVinBlock(), skipCache: false, fetchImpl });
    expect(out.timedOut).toBe(false);
    expect(out.body.summary).toBe("TheCarApi kļūda");
    expect(calls).toHaveLength(1);
  });
});

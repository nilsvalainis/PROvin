import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyMarketplaceQuery } from "@/lib/marketplace/types";
import { marketplaceActorSearchInput } from "@/lib/marketplace/search-urls";
import {
  apifyRunChargedUsd,
  marketplaceActorId,
  marketplaceApifyRunUrl,
  marketplaceApifySearchPayload,
  MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR_DEFAULT,
  MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT,
  runMarketplaceApifyActor,
  setMarketplaceApifyHttpHooks,
  setMarketplaceApifyRunner,
} from "@/lib/marketplace/apify-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("marketplace Apify HTTP runner", () => {
  const prev: Record<string, string | undefined> = {};
  const keys = ["MARKETPLACE_LOADS_ENABLED", "APIFY_TOKEN", "MARKETPLACE_PER_RUN_USD_CAP", "MARKETPLACE_APIFY_WAIT_SECONDS"] as const;

  beforeEach(() => {
    for (const key of keys) prev[key] = process.env[key];
    process.env.MARKETPLACE_LOADS_ENABLED = "true";
    process.env.APIFY_TOKEN = "test-token";
    process.env.MARKETPLACE_PER_RUN_USD_CAP = "0.5";
    process.env.MARKETPLACE_APIFY_WAIT_SECONDS = "20";
    setMarketplaceApifyRunner(null);
  });

  afterEach(() => {
    setMarketplaceApifyHttpHooks(null);
    setMarketplaceApifyRunner(null);
    vi.unstubAllGlobals();
    for (const key of keys) {
      if (prev[key] == null) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it("builds run URL with encoded actor ~, maxItems and maxTotalChargeUsd", () => {
    const url = marketplaceApifyRunUrl(MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT, 40, 0.5, 90);
    expect(url.startsWith("https://api.apify.com/v2/acts/")).toBe(true);
    expect(url).toContain(encodeURIComponent(MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT));
    expect(url).toContain("maxItems=40");
    expect(url).toContain("maxTotalChargeUsd=0.5");
    expect(url).toContain("waitForFinish=");
  });

  it("POSTs actor run then reads dataset items and real usageTotalUsd", async () => {
    const calls: Array<{ url: string; method: string; body: string; auth: string }> = [];
    setMarketplaceApifyHttpHooks({
      fetchImpl: (async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body = typeof init?.body === "string" ? init.body : "";
        const auth = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
        calls.push({ url, method, body, auth });
        if (method === "POST" && url.includes("/acts/")) {
          expect(url).toContain("maxItems=40");
          expect(url).toContain("maxTotalChargeUsd=0.5");
          expect(auth).toBe("Bearer test-token");
          return jsonResponse({
            data: {
              id: "run-1",
              status: "SUCCEEDED",
              defaultDatasetId: "ds-1",
              usageTotalUsd: 0.028,
            },
          });
        }
        if (url.includes("/datasets/ds-1/items")) {
          expect(url).toContain("limit=40");
          return jsonResponse([{ canonicalUrl: "https://suchen.mobile.de/fahrzeuge/details.html?id=1", title: "Volvo" }]);
        }
        throw new Error(`unexpected fetch ${method} ${url}`);
      }) as typeof fetch,
    });

    const q = emptyMarketplaceQuery();
    q.make = "Volvo";
    q.model = "XC60";
    const out = await runMarketplaceApifyActor({
      actorId: MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT,
      payload: marketplaceActorSearchInput("mobilede", q, { maxItems: 40 }),
      maxItems: 40,
      maxUsd: 0.5,
      usdPerThousand: 0.59,
    });
    expect(out.ok).toBe(true);
    expect(out.chargedUsd).toBe(0.028);
    expect(out.items).toHaveLength(1);
    const post = calls.find((c) => c.method === "POST");
    expect(post?.url).toContain(encodeURIComponent("blackfalcondata~mobile-de-scraper"));
    const sent = JSON.parse(post?.body ?? "{}") as Record<string, unknown>;
    expect(Array.isArray(sent.startUrls)).toBe(true);
    expect(typeof (sent.startUrls as string[])[0]).toBe("string");
    expect(sent.maxResults).toBe(40);
    expect(sent.damageStatus).toBe("EXCLUDE");
    expect(sent.includeDetails).toBe(false);
    expect(sent).not.toHaveProperty("fuelType");
    expect(sent).not.toHaveProperty("webhook");
  });

  it("sends AutoScout24 searchUrls objects and drops webhook fields", async () => {
    setMarketplaceApifyHttpHooks({
      fetchImpl: (async (input, init) => {
        const url = String(input);
        if ((init?.method ?? "GET") === "POST") {
          const sent = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
          expect(url).toContain(encodeURIComponent(MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR_DEFAULT));
          expect(url).toContain("maxItems=40");
          expect(url).toContain("maxTotalChargeUsd=0.5");
          const urls = sent.searchUrls as { url: string }[];
          expect(urls[0]?.url).toContain("autoscout24.de");
          expect(sent.maxResults).toBe(40);
          expect(sent.includeDetails).toBe(false);
          expect(sent).not.toHaveProperty("webhook");
          expect(sent).not.toHaveProperty("telegram");
          return jsonResponse({
            data: { id: "run-2", status: "SUCCEEDED", defaultDatasetId: "ds-2", usageTotalUsd: 0.019 },
          });
        }
        return jsonResponse([{ url: "https://www.autoscout24.de/angebote/x", title: "Volvo" }]);
      }) as typeof fetch,
    });
    const q = emptyMarketplaceQuery();
    q.make = "Volvo";
    q.model = "XC60";
    const payload = marketplaceApifySearchPayload(
      { ...marketplaceActorSearchInput("autoscout24", q, { maxItems: 40 }), webhook: "https://evil", telegram: 1 },
      { maxItems: 40, maxUsd: 0.5 },
    );
    const out = await runMarketplaceApifyActor({
      actorId: MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR_DEFAULT,
      payload,
      maxItems: 40,
      maxUsd: 0.5,
      usdPerThousand: 0.49,
    });
    expect(out.ok).toBe(true);
    expect(out.chargedUsd).toBe(0.019);
  });

  it("does not fetch when MARKETPLACE_LOADS_ENABLED is not true", async () => {
    delete process.env.MARKETPLACE_LOADS_ENABLED;
    const fetchImpl = vi.fn();
    setMarketplaceApifyHttpHooks({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const out = await runMarketplaceApifyActor({
      actorId: MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT,
      payload: { startUrls: ["https://suchen.mobile.de/x"] },
      maxItems: 10,
      maxUsd: 0.5,
    });
    expect(out.error).toBe("loads_disabled");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses chargedEventCounts when usageTotalUsd is missing", () => {
    expect(apifyRunChargedUsd({ chargedEventCounts: { "actor-start": 1, "result-item": 40 } }, 0, 0.59)).toBe(0.029);
  });

  it("defaults actor IDs to the Store scrapers from 19.10", () => {
    delete process.env.MARKETPLACE_APIFY_MOBILEDE_ACTOR;
    delete process.env.MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR;
    expect(marketplaceActorId("MARKETPLACE_APIFY_MOBILEDE_ACTOR")).toBe("blackfalcondata~mobile-de-scraper");
    expect(marketplaceActorId("MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR")).toBe("blackfalcondata~autoscout24-scraper");
  });
});

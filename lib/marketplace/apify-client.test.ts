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
import { createApifyMobiledeProvider } from "@/lib/marketplace/providers/apify-mobilede";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function useFetch(fetchImpl: typeof fetch): void {
  setMarketplaceApifyHttpHooks({ fetchImpl, sleep: async () => {} });
}

describe("marketplace Apify HTTP runner", () => {
  const prev: Record<string, string | undefined> = {};
  const keys = ["MARKETPLACE_LOADS_ENABLED", "APIFY_TOKEN", "MARKETPLACE_PER_RUN_USD_CAP", "MARKETPLACE_APIFY_WAIT_SECONDS"] as const;
  let info: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of keys) prev[key] = process.env[key];
    process.env.MARKETPLACE_LOADS_ENABLED = "true";
    process.env.APIFY_TOKEN = "test-token";
    process.env.MARKETPLACE_PER_RUN_USD_CAP = "0.5";
    process.env.MARKETPLACE_APIFY_WAIT_SECONDS = "20";
    setMarketplaceApifyRunner(null);
    info = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    info.mockRestore();
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
    useFetch((async (input, init) => {
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
        if (url.includes("/actor-runs/run-1")) {
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
      }) as typeof fetch);

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
    expect(out.apifyRunId).toBe("run-1");
    expect(out.items).toHaveLength(1);
    expect(info).toHaveBeenCalledWith(
      "[marketplace]",
      expect.objectContaining({
        provider: MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT,
        apifyRunId: "run-1",
        status: "SUCCEEDED",
        items: 1,
        chargedUsd: 0.028,
      }),
    );
    const post = calls.find((c) => c.method === "POST");
    expect(post?.url).toContain(encodeURIComponent("blackfalcondata~mobile-de-scraper"));
    const sent = JSON.parse(post?.body ?? "{}") as Record<string, unknown>;
    expect(sent).not.toHaveProperty("startUrls");
    expect(sent.make).toBe("Volvo");
    expect(sent.model).toBe("XC60");
    expect(sent.sellerType).toBe("DEALER");
    expect(sent.maxResults).toBe(40);
    expect(sent.damageStatus).toBe("EXCLUDE");
    expect(sent.includeDetails).toBe(false);
    expect(sent).not.toHaveProperty("webhook");
  });

  it("sends AutoScout24 searchUrls objects and drops webhook fields", async () => {
    useFetch((async (input, init) => {
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
      }) as typeof fetch);
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

  it("returns chargedUsd, apifyRunId and error when the actor run is not ok", async () => {
    useFetch((async (input, init) => {
        if ((init?.method ?? "GET") === "POST") {
          return jsonResponse({
            data: {
              id: "run-fail",
              status: "FAILED",
              usageTotalUsd: 0,
              chargedEventCounts: { "apify-actor-start": 1 },
            },
          });
        }
        throw new Error(`unexpected fetch ${String(input)}`);
      }) as typeof fetch);
    const out = await runMarketplaceApifyActor({
      actorId: MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT,
      payload: marketplaceActorSearchInput("mobilede", emptyMarketplaceQuery(), { maxItems: 10 }),
      maxItems: 10,
      maxUsd: 0.5,
      usdPerThousand: 0.59,
    });
    expect(out.ok).toBe(false);
    expect(out.error).toBe("apify_failed");
    expect(out.apifyRunId).toBe("run-fail");
    expect(out.chargedUsd).toBe(0.005);
    expect(out.items).toEqual([]);
    expect(info).toHaveBeenCalledWith(
      "[marketplace]",
      expect.objectContaining({
        provider: MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT,
        apifyRunId: "run-fail",
        status: "apify_failed",
        items: 0,
        chargedUsd: 0.005,
      }),
    );
  });

  it("does not fetch when MARKETPLACE_LOADS_ENABLED is switched off", async () => {
    process.env.MARKETPLACE_LOADS_ENABLED = "false";
    const fetchImpl = vi.fn();
    useFetch(fetchImpl as unknown as typeof fetch);
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
    expect(apifyRunChargedUsd({ chargedEventCounts: { "actor-start": 1, "result-item": 40 } }, 0, 0.00059)).toBeCloseTo(
      0.0286,
      8,
    );
  });

  it("takes max of reported start-only events and dataset items times per-result price", () => {
    expect(
      apifyRunChargedUsd({ chargedEventCounts: { "apify-actor-start": 1 } }, 0, 0.00059, 10),
    ).toBeCloseTo(0.0109, 8);
    expect(
      apifyRunChargedUsd({ usageTotalUsd: 0.005, chargedEventCounts: { "apify-actor-start": 1 } }, 0, 0.00049, 10),
    ).toBeCloseTo(0.0099, 8);
    expect(
      apifyRunChargedUsd({ usageTotalUsd: 0.05, chargedEventCounts: { "apify-actor-start": 1 } }, 0, 0.00059, 10),
    ).toBe(0.05);
  });

  it("does not trust usageTotalUsd=0 on pay-per-event actors", () => {
    expect(
      apifyRunChargedUsd(
        {
          usageTotalUsd: 0,
          chargedEventCounts: { "apify-actor-start": 1, "apify-default-dataset-item": 10 },
        },
        0,
        0.00059,
      ),
    ).toBeCloseTo(0.0109, 8);
    expect(
      apifyRunChargedUsd(
        {
          usageTotalUsd: 0,
          chargedEventUsd: 0.042,
          chargedEventCounts: { "apify-actor-start": 1, "apify-default-dataset-item": 10 },
        },
        0,
        0.00059,
      ),
    ).toBe(0.042);
    expect(
      apifyRunChargedUsd(
        {
          usageTotalUsd: 0.008,
          chargedEventCounts: { "apify-actor-start": 1, "apify-default-dataset-item": 40 },
        },
        0,
        0.00059,
      ),
    ).toBeCloseTo(0.0286, 8);
  });

  it("re-fetches the run after SUCCEEDED before reading chargedEventCounts", async () => {
    const calls: string[] = [];
    useFetch((async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url}`);
      if (method === "POST") {
        return jsonResponse({
          data: {
            id: "run-late",
            status: "SUCCEEDED",
            defaultDatasetId: "ds-late",
            chargedEventCounts: { "apify-actor-start": 1 },
          },
        });
      }
      if (url.includes("/actor-runs/run-late")) {
        return jsonResponse({
          data: {
            id: "run-late",
            status: "SUCCEEDED",
            defaultDatasetId: "ds-late",
            chargedEventCounts: { "apify-actor-start": 1, "apify-default-dataset-item": 10 },
          },
        });
      }
      if (url.includes("/datasets/ds-late/items")) {
        return jsonResponse(Array.from({ length: 10 }, (_, i) => ({ listingKey: String(i), url: `https://suchen.mobile.de/x?id=${i}`, title: "Audi A6" })));
      }
      throw new Error(`unexpected fetch ${method} ${url}`);
    }) as typeof fetch);
    const out = await runMarketplaceApifyActor({
      actorId: MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT,
      payload: marketplaceActorSearchInput("mobilede", emptyMarketplaceQuery(), { maxItems: 10 }),
      maxItems: 10,
      maxUsd: 0.5,
      usdPerResult: 0.00059,
    });
    expect(out.ok).toBe(true);
    expect(out.items).toHaveLength(10);
    expect(out.chargedUsd).toBeCloseTo(0.0109, 8);
    expect(calls.some((c) => c.startsWith("GET ") && c.includes("/actor-runs/run-late"))).toBe(true);
  });

  it("defaults actor IDs to the Store scrapers from 19.10", () => {
    delete process.env.MARKETPLACE_APIFY_MOBILEDE_ACTOR;
    delete process.env.MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR;
    expect(marketplaceActorId("MARKETPLACE_APIFY_MOBILEDE_ACTOR")).toBe("blackfalcondata~mobile-de-scraper");
    expect(marketplaceActorId("MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR")).toBe("blackfalcondata~autoscout24-scraper");
  });

  it("provider search returns Avota kļūda and chargedUsd when the Apify run is not ok", async () => {
    setMarketplaceApifyRunner(async () => ({
      ok: false,
      items: [],
      chargedUsd: 0.005,
      error: "apify_failed",
      apifyRunId: "run-err",
    }));
    const found = await createApifyMobiledeProvider().search(emptyMarketplaceQuery(), { maxItems: 10, maxUsd: 0.5 });
    expect(found.items).toEqual([]);
    expect(found.chargedUsd).toBe(0.005);
    expect(found.apifyRunId).toBe("run-err");
    expect(found.error).toBe("Avota kļūda: mobile.de: Apify failed");
  });
});

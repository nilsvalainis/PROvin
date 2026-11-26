/**
 * 26.11: vecs kešs bez `detailPath` (arhivēta lote saņēma 404 katrā klikšķī) un bilžu saraksts,
 * ko TheCarApi vēl lejupielādēja (`pending`), netika pieprasīts vēlreiz.
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildThecarapiAdminRecords } from "@/lib/vin-scan/parse-thecarapi";
import { writeThecarapiImageCache, writeThecarapiVinCache } from "@/lib/vin-scan/store";
import {
  fetchThecarapiAuctionImages,
  fetchThecarapiVinWithDetails,
  thecarapiFillRefPaths,
  thecarapiImagesPending,
  type ThecarapiDeps,
} from "@/lib/vin-scan/thecarapi-api";

let dir = "";

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "thecarapi-celi-"));
  vi.stubEnv("VIN_SCAN_DIR", dir);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function scripted(responses: Response[]): { deps: ThecarapiDeps; urls: string[] } {
  const urls: string[] = [];
  const queue = [...responses];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    urls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const next = queue.shift();
    if (!next) throw new Error("unexpected_fetch");
    return next;
  }) as typeof fetch;
  return {
    urls,
    deps: {
      env: { THECARAPI_API_KEY: "test-key", THECARAPI_ADMIN_ENABLED: "true", THECARAPI_BASE_URL: "https://api.thecarapi.com" },
      fetch: fetchImpl,
      sleep: async () => undefined,
    },
  };
}

const archivedRow = {
  site_name: "auto1",
  auction_id: 1324732982,
  archived: true,
  detail_path: "/api/archive/auction/auto1/1324732982",
  mileage: 218863,
  first_seen_at: "2026-09-15T14:42:05",
  is_active: false,
};

describe("TheCarApi detaļu ceļš no vēstures ieraksta", () => {
  it("thecarapiFillRefPaths papildina ref bez ceļa ar arhīva ceļu", () => {
    const records = buildThecarapiAdminRecords({ historyJson: { auctions: [archivedRow] } });
    const out = thecarapiFillRefPaths([{ site: "auto1", id: "1324732982", active: false }], records);
    expect(out[0]?.detailPath).toBe("/api/archive/auction/auto1/1324732982");
  });

  it("vecs kešs bez detailPath: detaļu prasa pa /api/archive/auction/..., nevis /api/auction/...", async () => {
    const vin = "TMBLK7NS5J8075631";
    const records = buildThecarapiAdminRecords({ historyJson: { auctions: [archivedRow] } });
    await writeThecarapiVinCache(
      vin,
      { status: "found", summary: "AUTO1, 2026, 1 ieraksti" },
      { httpStatus: 200, refs: [{ site: "auto1", id: "1324732982", active: false }], records, recordsComplete: false },
    );
    const { deps, urls } = scripted([json(404, { success: false }), json(200, { images: [] })]);
    await fetchThecarapiVinWithDetails(vin, deps);
    expect(urls[0]).toBe("https://api.thecarapi.com/api/archive/auction/auto1/1324732982");
    expect(urls.some((url) => url === "https://api.thecarapi.com/api/auction/auto1/1324732982")).toBe(false);
  });
});

describe("TheCarApi bildes ar `pending`", () => {
  it("thecarapiImagesPending", () => {
    expect(thecarapiImagesPending({ count: 1, pending: 45, images: [{}] })).toBe(true);
    expect(thecarapiImagesPending({ count: 46, pending: 0, images: [] })).toBe(false);
    expect(thecarapiImagesPending(null)).toBe(false);
  });

  it("kešs ar pending > 0 tiek pieprasīts vēlreiz; pilns kešs - nē", async () => {
    await writeThecarapiImageCache({
      site: "auto1",
      id: "P-1",
      cachedAt: new Date().toISOString(),
      active: false,
      json: { count: 1, pending: 45, images: [{ url: "https://img-pa.auto1.com/a.jpg" }] },
    });
    const first = scripted([json(200, { count: 46, pending: 0, images: [{ url: "https://img-pa.auto1.com/a.jpg" }] })]);
    const out = await fetchThecarapiAuctionImages([{ site: "auto1", id: "P-1", active: false }], first.deps);
    expect(first.urls).toEqual(["https://api.thecarapi.com/api/auction-images/auto1/P-1"]);
    expect((out.byKey["auto1:P-1"] as { count?: number } | undefined)?.count).toBe(46);

    const second = scripted([]);
    await fetchThecarapiAuctionImages([{ site: "auto1", id: "P-1", active: false }], second.deps);
    expect(second.urls).toEqual([]);
  });
});

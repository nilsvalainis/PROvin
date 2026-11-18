import { mkdtempSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { fetchThecarapiCcVinMerge } from "@/lib/thecarapi-cc-vin";
import { isFreeVinScanSourceId } from "@/lib/vin-scan/free-sources";
import { probeThecarapi } from "@/lib/vin-scan/probes-extra";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { fetchThecarapiVinHistory, fetchThecarapiVinWithDetails, thecarapiMonthlyCap } from "@/lib/vin-scan/thecarapi-api";
import { buildThecarapiAdminRecords, parseThecarapiHistory } from "@/lib/vin-scan/parse-thecarapi";
import { writeThecarapiVinCache } from "@/lib/vin-scan/store";
import { readVinMemory } from "@/lib/vin-memory-store";
import { vinScanPipelineSourceIds } from "@/lib/vin-scan/catalog";
import type { ThecarapiDeps } from "@/lib/vin-scan/thecarapi-api";

const hit = JSON.parse(
  readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/history-hit.json"), "utf8"),
) as unknown;
const empty = JSON.parse(
  readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/history-empty.json"), "utf8"),
) as unknown;
const detailAuto1 = JSON.parse(
  readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/detail-auto1.json"), "utf8"),
) as unknown;
const detailAuto1Wrapped = JSON.parse(
  readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/detail-auto1-envelope-simple.json"), "utf8"),
) as unknown;
const imagesAuto1 = JSON.parse(
  readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/images-auto1.json"), "utf8"),
) as unknown;

let dir = "";

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "thecarapi-"));
  vi.stubEnv("VIN_SCAN_DIR", dir);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VIN_SCAN_DIR", dir);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
});

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function paidEnv(extra: Record<string, string> = {}): Record<string, string> {
  return {
    THECARAPI_API_KEY: "test-key",
    THECARAPI_ADMIN_ENABLED: "true",
    THECARAPI_VIN_SCAN_ENABLED: "",
    THECARAPI_BASE_URL: "https://api.thecarapi.com",
    THECARAPI_MONTHLY_CAP: "150",
    ...extra,
  };
}

function scripted(responses: Array<Response | Error>): {
  deps: ThecarapiDeps;
  calls: { url: string; init?: RequestInit }[];
  sleeps: number[];
} {
  const calls: { url: string; init?: RequestInit }[] = [];
  const sleeps: number[] = [];
  const queue = [...responses];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error("unexpected_fetch");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return {
    calls,
    sleeps,
    deps: {
      env: paidEnv(),
      fetch: fetchImpl,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    },
  };
}

function header(init: RequestInit | undefined, name: string): string {
  const headers = new Headers(init?.headers);
  return headers.get(name) ?? "";
}

describe("fetchThecarapiVinHistory", () => {
  it("200 ar ierakstiem", async () => {
    const { deps, calls } = scripted([jsonResponse(200, hit, { etag: "W/\"hit\"" })]);
    const result = await fetchThecarapiVinHistory("WBA5R1C00LFH42871", deps);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.thecarapi.com/api/vin/WBA5R1C00LFH42871/history");
    expect(header(calls[0]?.init, "X-API-Key")).toBe("test-key");
    expect(header(calls[0]?.init, "cache-control") || calls[0]?.init?.cache).toBe("no-store");
    expect(result.httpStatus).toBe(200);
    expect(result.billable).toBe(true);
    expect(result.fromCache).toBe(false);
    expect(result.parse.status).toBe("found");
    expect(result.parse.auctions?.[0]?.venue).toBe("Openlane");
    expect(result.refs[0]).toMatchObject({ site: "openlane", id: "OL-55" });
  });

  it("200 tukšs", async () => {
    const { deps, calls } = scripted([jsonResponse(200, empty)]);
    const result = await fetchThecarapiVinHistory("WBA5R1C00LFH42872", deps);
    expect(calls).toHaveLength(1);
    expect(result.parse).toMatchObject({ status: "none", summary: "nav ierakstu" });
    expect(result.billable).toBe(true);
  });

  it("401 un 403 neatkārto un nesaka atslēga nederīga/beigusies", async () => {
    const denied = scripted([jsonResponse(401, { error: "expired" })]);
    const expired = await fetchThecarapiVinHistory("WBA5R1C00LFH42873", denied.deps);
    expect(denied.calls).toHaveLength(1);
    expect(denied.sleeps).toEqual([]);
    expect(expired.parse).toMatchObject({ status: "unknown", summary: "atslēga nederīga/beigusies" });

    const revoked = scripted([jsonResponse(403, { error: "revoked" })]);
    const blocked = await fetchThecarapiVinHistory("WBA5R1C00LFH42874", revoked.deps);
    expect(revoked.calls).toHaveLength(1);
    expect(blocked.parse.summary).toBe("atslēga nederīga/beigusies");
  });

  it("429 nelasa vēlreiz un ieliek Retry-After", async () => {
    const { deps, calls, sleeps } = scripted([jsonResponse(429, { error: "throttled" }, { "retry-after": "30" })]);
    const result = await fetchThecarapiVinHistory("WBA5R1C00LFH42875", deps);
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
    expect(result.parse.status).toBe("unknown");
    expect(result.parse.summary).toBe("limits");
    expect(result.parse.detail).toBe("Retry-After: 30");
    expect(result.billable).toBe(true);
  });

  it("500 atkārto vienu reizi pēc 2 s", async () => {
    const { deps, calls, sleeps } = scripted([
      jsonResponse(500, { error: "down" }),
      jsonResponse(200, empty),
    ]);
    const result = await fetchThecarapiVinHistory("WBA5R1C00LFH42876", deps);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
    expect(result.parse.status).toBe("none");
    expect(result.httpStatus).toBe(200);
  });

  it("timeout atkārto vienu reizi un paliek timeout", async () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    const { deps, calls, sleeps } = scripted([timeout, timeout]);
    const result = await fetchThecarapiVinHistory("WBA5R1C00LFH42877", deps);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
    expect(result.parse).toMatchObject({ status: "timeout", summary: "Avots neatbildēja laikā" });
    expect(result.billable).toBe(false);
    expect(result.httpStatus).toBeNull();
  });

  it("otrais izsaukums ņem kešu un vairs nefetchē", async () => {
    const { deps, calls } = scripted([jsonResponse(200, hit)]);
    const first = await fetchThecarapiVinHistory("WBA5R1C00LFH42878", deps);
    const second = await fetchThecarapiVinHistory("WBA5R1C00LFH42878", deps);
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.parse.status).toBe("found");
    expect(calls).toHaveLength(1);
  });

  it("THECARAPI_MONTHLY_CAP neaptur izsaukumu", async () => {
    expect(thecarapiMonthlyCap({})).toBe(0);
    expect(thecarapiMonthlyCap(paidEnv({ THECARAPI_MONTHLY_CAP: "1" }))).toBe(0);
    const first = scripted([jsonResponse(200, empty)]);
    first.deps.env = paidEnv({ THECARAPI_MONTHLY_CAP: "1" });
    first.deps.now = () => new Date("2099-04-02T00:00:00.000Z");
    const opened = await fetchThecarapiVinHistory("WBA5R1C00LFH42879", first.deps);
    expect(opened.billable).toBe(true);
    expect(first.calls).toHaveLength(1);

    const second = scripted([jsonResponse(200, empty)]);
    second.deps.env = paidEnv({ THECARAPI_MONTHLY_CAP: "1" });
    second.deps.now = () => new Date("2099-04-02T00:00:00.000Z");
    second.deps.skipCache = true;
    const again = await fetchThecarapiVinHistory("WBA5R1C00LFH42879", second.deps);
    expect(second.calls).toHaveLength(1);
    expect(again.parse.summary).not.toBe("mēneša limits");
    expect(again.billable).toBe(true);
  });
});

describe("TheCarApi VIN SCAN slēdzis", () => {
  it("bez THECARAPI_VIN_SCAN_ENABLED nav cauruļvadā un zonde nefetchē", async () => {
    vi.stubEnv("THECARAPI_API_KEY", "test-key");
    vi.stubEnv("THECARAPI_VIN_SCAN_ENABLED", "");
    vi.stubEnv("THECARAPI_ADMIN_ENABLED", "");
    const seen: string[] = [];
    const prev = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
      if (url.includes("api.thecarapi.com")) seen.push(url);
      return prev(input, init);
    }) as typeof fetch;
    try {
      expect(vinScanPipelineSourceIds()).not.toContain("thecarapi_eu");
      expect(isFreeVinScanSourceId("thecarapi_eu")).toBe(false);
      const row = await probeThecarapi({
        vin: "WBA5R1C00LFH42880",
        plates: emptyVinScanPlates(),
        listingUrl: "",
      });
      expect(row.status).toBe("skipped");
      expect(row.summary).toBe("TheCarApi izslēgts (maksas)");
      expect(seen).toEqual([]);
    } finally {
      globalThis.fetch = prev;
    }
  });
});

describe("fetchThecarapiVinWithDetails", () => {
  it("sauc vēsturi, batch un auction-images, bet ne CDN", async () => {
    const batch = { auctions: [detailAuto1] };
    const { deps, calls } = scripted([
      jsonResponse(200, hit, { etag: "W/\"hist\"" }),
      jsonResponse(200, batch),
      jsonResponse(200, { images: [] }),
      jsonResponse(200, imagesAuto1),
    ]);
    const vin = "WBA5R1C00LFH42881";
    const result = await fetchThecarapiVinWithDetails(vin, deps);
    expect(calls.map((call) => call.url)).toEqual([
      `https://api.thecarapi.com/api/vin/${vin}/history`,
      "https://api.thecarapi.com/api/auction/batch?ids=openlane%3AOL-55%2Cauto1%3AA1-100",
      "https://api.thecarapi.com/api/auction-images/openlane/OL-55",
      "https://api.thecarapi.com/api/auction-images/auto1/A1-100",
    ]);
    expect(calls.every((call) => call.url.startsWith("https://api.thecarapi.com/"))).toBe(true);
    const auto1 = result.records.find((row) => row.id === "A1-100");
    expect(auto1?.photoDate).toBe("2024-03-12");
    expect(auto1?.photoUrls).toContain("https://img-pa.auto1.com/img/extra.jpg");
    expect(auto1?.photoUrls.some((url) => url.startsWith("http://"))).toBe(false);
    expect(auto1?.fields.some((field) => field.key === "mystery_flag" && field.value === "keep-me")).toBe(true);
    expect(result.billable).toBe(true);
    const again = scripted([]);
    const cached = await fetchThecarapiVinWithDetails(vin, { ...again.deps, env: deps.env });
    expect(again.calls).toEqual([]);
    expect(cached.recordsComplete).toBe(true);
    expect(cached.records.find((row) => row.id === "A1-100")?.photoUrls).toContain("https://img-pa.auto1.com/img/extra.jpg");
  });

  it("pēc history izsauc AUTO1 detail aploksni un apvieno bojājumus ar bildēm", async () => {
    const wrapped = JSON.parse(
      readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/detail-auto1-wrapped.json"), "utf8"),
    ) as unknown;
    const history = {
      auctions: [
        {
          site_name: "auto1",
          auction_id: "1326383403",
          mileage: 77387,
          current_final: 12268,
          start: 10000,
          first_seen: "2026-10-09",
          seller: "AUTO1 GmbH",
          location: "Berlin",
          archived: false,
        },
      ],
    };
    const vin = "WBA6X310305V99966";
    const { deps, calls } = scripted([
      jsonResponse(200, history),
      jsonResponse(200, wrapped),
      jsonResponse(200, { images: [] }),
    ]);
    const result = await fetchThecarapiVinWithDetails(vin, deps);
    expect(calls.map((call) => call.url)).toEqual([
      `https://api.thecarapi.com/api/vin/${vin}/history`,
      "https://api.thecarapi.com/api/auction/auto1/1326383403",
      "https://api.thecarapi.com/api/auction-images/auto1/1326383403",
    ]);
    const row = result.records.find((item) => item.id === "1326383403");
    expect(result.recordsComplete).toBe(true);
    expect(row?.rawDetail).toBeTruthy();
    expect(row?.photoUrls).toHaveLength(29);
    expect(row?.photoDate).toBe("2026-10-09");
    expect(row?.fields.some((field) => field.key === "damages[0].zone" && field.value === "Priekšējais bamperis")).toBe(true);
    expect(row?.fields.some((field) => field.key === "equipment" && field.value.includes("Navigācija"))).toBe(true);
    const again = scripted([]);
    const cached = await fetchThecarapiVinWithDetails(vin, { ...again.deps, env: deps.env });
    expect(again.calls).toEqual([]);
    expect(cached.records.find((item) => item.id === "1326383403")?.photoUrls).toHaveLength(29);
  });

  it("neizlaiž detail, ja kešā ir tikai history un recordsComplete", async () => {
    const wrapped = JSON.parse(
      readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/detail-auto1-wrapped.json"), "utf8"),
    ) as unknown;
    const history = {
      auctions: [
        {
          site_name: "auto1",
          auction_id: "1326383403",
          mileage: 50000,
          first_seen: "2026-10-09",
        },
      ],
    };
    const vin = "WBA6X310305V99967";
    const lot = "1326383499";
    history.auctions[0]!.auction_id = lot;
    const detail = wrapped as { auction?: { id?: number } };
    if (detail.auction) detail.auction.id = Number(lot);
    const parsed = parseThecarapiHistory({ json: history });
    await writeThecarapiVinCache(vin, parsed.parse, {
      refs: parsed.refs,
      records: buildThecarapiAdminRecords({ historyJson: history }),
      recordsComplete: true,
    });
    const { deps, calls } = scripted([jsonResponse(200, detail), jsonResponse(200, { images: [] })]);
    const result = await fetchThecarapiVinWithDetails(vin, deps);
    expect(calls[0]?.url).toBe(`https://api.thecarapi.com/api/auction/auto1/${lot}`);
    expect(result.records.find((item) => item.id === lot)?.fields.some((field) => field.value === "Priekšējais bamperis")).toBe(true);
  });

  it("viena lota ietītā detaļa nonāk ierakstā un tiek kešota", async () => {
    const base = (hit as { auctions: Record<string, unknown>[] }).auctions[1];
    const single = { auctions: [{ ...base, auction_id: "A1-200", detail_path: "/api/auction/auto1/A1-200" }] };
    const { deps, calls } = scripted([
      jsonResponse(200, single),
      jsonResponse(200, detailAuto1Wrapped),
      jsonResponse(200, { images: [] }),
    ]);
    const vin = "WBA5R1C00LFH42883";
    const result = await fetchThecarapiVinWithDetails(vin, { ...deps, skipCache: true });
    expect(calls.map((call) => call.url)).toEqual([
      `https://api.thecarapi.com/api/vin/${vin}/history`,
      "https://api.thecarapi.com/api/auction/auto1/A1-200",
      "https://api.thecarapi.com/api/auction-images/auto1/A1-200",
    ]);
    const auto1 = result.records.find((row) => row.id === "A1-200");
    expect(auto1?.fields.some((field) => field.key === "wrapped_only_field" && field.value === "keep-me-too")).toBe(true);
    expect(auto1?.photoUrls).toEqual(
      expect.arrayContaining([
        "https://img-pa.auto1.com/img/w-main.jpg",
        "https://img-pa.auto1.com/img/w-damage.jpg",
        "https://img-pa.auto1.com/img/w-service.jpg",
        "https://img-pa.auto1.com/img/w-vault.jpg",
        "https://img-pa.auto1.com/img/w-sub.jpg",
      ]),
    );

    const again = scripted([jsonResponse(200, single)]);
    await fetchThecarapiVinWithDetails(`${vin.slice(0, 16)}4`, { ...again.deps, env: deps.env });
    const detailCalls = again.calls.filter((call) => call.url.includes("/api/auction/"));
    expect(detailCalls).toEqual([]);
  });

  it("arhivēta lote: detaļu sauc pa /api/archive/auction/... un ietinums {archive} dod bildes", async () => {
    const lot = "1324732982";
    const history = {
      auctions: [
        {
          site_name: "auto1",
          auction_id: Number(lot),
          detail_path: `/api/archive/auction/auto1/${lot}`,
          archived: true,
          archived_at: "2026-11-03T05:06:55",
          mileage: 218863,
          first_seen: "2026-09-10",
        },
      ],
    };
    const archive = {
      success: true,
      archive: {
        site_name: "auto1",
        auction_id: Number(lot),
        archive_only_field: "arhiva-lauks",
        car_identification: {
          ImageUrls: ["https://img-pa.auto1.com/img/arch-1.jpg", "https://img-pa.auto1.com/img/arch-2.jpg"],
        },
      },
    };
    const { deps, calls } = scripted([jsonResponse(200, history), jsonResponse(200, archive), jsonResponse(200, { images: [] })]);
    const vin = "TMBLK7NS5J8075631";
    const result = await fetchThecarapiVinWithDetails(vin, { ...deps, skipCache: true });
    expect(calls.map((call) => call.url)).toEqual([
      `https://api.thecarapi.com/api/vin/${vin}/history`,
      `https://api.thecarapi.com/api/archive/auction/auto1/${lot}`,
      `https://api.thecarapi.com/api/auction-images/auto1/${lot}`,
    ]);
    const rec = result.records.find((row) => row.id === lot);
    expect(rec?.photoUrls).toEqual(
      expect.arrayContaining(["https://img-pa.auto1.com/img/arch-1.jpg", "https://img-pa.auto1.com/img/arch-2.jpg"]),
    );
    expect(rec?.fields.some((field) => field.key === "archive_only_field")).toBe(true);
    expect(result.detailDiag).toEqual([]);
  });

  it("arhīva un aktīvā lote netiek liktas vienā batch; trūkstošai detaļai ir diagnostika", async () => {
    const history = {
      auctions: [
        { site_name: "openlane", auction_id: 11847089, detail_path: "/api/archive/auction/openlane/11847089", archived: true, mileage: 186113, first_seen: "2026-07-27" },
        { site_name: "auto1", auction_id: 1326383499, detail_path: "/api/auction/auto1/1326383499", archived: false, mileage: 186000, first_seen: "2026-10-01" },
      ],
    };
    const { deps, calls } = scripted([
      jsonResponse(200, history),
      jsonResponse(200, { success: true, request_id: "r1", unexpected: { foo: 1 } }),
      jsonResponse(200, { auctions: [] }),
      jsonResponse(200, { images: [] }),
      jsonResponse(200, { images: [] }),
    ]);
    const vin = "KNACC81CGM5458422";
    const result = await fetchThecarapiVinWithDetails(vin, { ...deps, skipCache: true });
    const detailUrls = calls.map((call) => call.url).filter((url) => !url.includes("/history") && !url.includes("auction-images"));
    expect(detailUrls).toEqual([
      "https://api.thecarapi.com/api/archive/auction/openlane/11847089",
      "https://api.thecarapi.com/api/auction/auto1/1326383499",
    ]);
    const archDiag = result.detailDiag?.find((row) => row.id === "11847089");
    expect(archDiag).toMatchObject({
      site: "openlane",
      status: 200,
      path: "/api/archive/auction/openlane/11847089",
      topKeys: ["success", "request_id", "unexpected"],
      note: "detail_absent",
    });
    expect(JSON.stringify(result.detailDiag)).not.toContain("r1");
  });

  it("history kešs bez detail izsauc detail_path un apvieno auction.images", async () => {
    const live = JSON.parse(
      readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/detail-auto1-live-shape.json"), "utf8"),
    ) as { auction: { id: number } };
    const lot = "1326383507";
    live.auction.id = Number(lot);
    const history = {
      auctions: [
        {
          site_name: "auto1",
          auction_id: lot,
          detail_path: `/api/auction/auto1/${lot}`,
          mileage: 77387,
          first_seen: "2026-09-01",
          archived: false,
          archived_at: null,
        },
      ],
    };
    const vin = "WBA6X310305V99968";
    const parsed = parseThecarapiHistory({ json: history });
    await writeThecarapiVinCache(vin, parsed.parse, {
      refs: parsed.refs,
      records: buildThecarapiAdminRecords({ historyJson: history }),
      recordsComplete: true,
    });
    const { deps, calls } = scripted([jsonResponse(200, live), jsonResponse(200, { images: [] })]);
    const result = await fetchThecarapiVinWithDetails(vin, deps);
    expect(calls.map((call) => call.url)).toEqual([
      `https://api.thecarapi.com/api/auction/auto1/${lot}`,
      `https://api.thecarapi.com/api/auction-images/auto1/${lot}`,
    ]);
    const row = result.records.find((item) => item.id === lot);
    expect(result.recordsComplete).toBe(true);
    expect(JSON.stringify(row?.raw)).toContain("car_identification");
    expect(JSON.stringify(row?.raw)).toContain("live-1.jpg");
    expect(row?.photoUrls).toContain("https://img-pa.auto1.com/img/cid-doc.jpg");
    expect(row?.photoUrls.some((url) => url.includes("/auction-photo/"))).toBe(false);
    expect(row?.photoDate).toBe("2026-10-09");
    expect(row?.fields.some((field) => field.key === "Auto1Details.kw" && field.value === "140")).toBe(true);
    const again = scripted([]);
    await fetchThecarapiVinWithDetails(vin, { ...again.deps, env: deps.env });
    expect(again.calls).toEqual([]);
  });

  it("admin ceļš saglabā arhīvā ar archived_at un bildes datumu", async () => {
    vi.stubEnv("ADMIN_ORDER_DRAFT_DIR", dir);
    const live = JSON.parse(
      readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/detail-auto1-live-shape.json"), "utf8"),
    ) as { auction: { id: number } };
    const lot = "1326383508";
    live.auction.id = Number(lot);
    const history = {
      auctions: [
        {
          site_name: "auto1",
          auction_id: lot,
          detail_path: `/api/auction/auto1/${lot}`,
          mileage: 77387,
          first_seen: "2026-09-01",
        },
      ],
    };
    const vin = "WBA6X310305V99969";
    const { deps, calls } = scripted([
      jsonResponse(200, history),
      jsonResponse(200, live),
      jsonResponse(200, { images: [] }),
    ]);
    const result = await fetchThecarapiCcVinMerge({
      vin,
      deps,
      fetchJpegs: async (urls) => ({
        ok: urls.slice(0, 2).map((url, index) => ({
          ok: true as const,
          url,
          jpeg: Buffer.from(`jpeg-${index}`),
          contentHash: `hash-${lot}-${index}`,
        })),
        failed: [],
      }),
      writeJpeg: async () => undefined,
    });
    expect(calls[0]?.url).toBe(`https://api.thecarapi.com/api/vin/${vin}/history`);
    expect(calls[1]?.url).toBe(`https://api.thecarapi.com/api/auction/auto1/${lot}`);
    const row = result.records.find((item) => item.id === lot);
    expect(row?.fields[0]).toMatchObject({ label: "Arhīvā", value: "jā" });
    expect(row?.fields.some((field) => field.key === "archived_at" && field.value.startsWith("20"))).toBe(true);
    expect(row?.photos[0]?.date).toBe("2026-10-09");
    const memory = await readVinMemory(vin);
    expect(memory?.observations[0]?.archivedAt).toMatch(/^20/);
    expect(memory?.observations[0]?.photos?.[0]?.date).toBe("2026-10-09");
    expect(memory?.observations[0]?.auctionId).toBe(lot);
  });

  it("pēc ielādes liek bildes pasūtījuma galerijā un arhīva sesijā", async () => {
    const { deps, calls } = scripted([
      jsonResponse(200, hit),
      jsonResponse(200, { auctions: [detailAuto1] }),
      jsonResponse(200, { images: [] }),
      jsonResponse(200, imagesAuto1),
    ]);
    const vin = "WBA5R1C00LFH42882";
    const writes: string[] = [];
    const result = await fetchThecarapiCcVinMerge({
      vin,
      sessionId: "orderSession82",
      deps,
      fetchJpegs: async (urls) => ({
        ok: urls.map((url) => ({ ok: true as const, url, jpeg: Buffer.from("jpeg"), contentHash: `h-${url}` })),
        failed: [],
      }),
      writeJpeg: async (sessionId) => {
        writes.push(sessionId);
      },
    });
    expect(calls.every((call) => call.url.startsWith("https://api.thecarapi.com/"))).toBe(true);
    expect(writes).toContain(`tc${vin}`);
    expect(writes).toContain("orderSession82");
    expect(result.block.thecarapiRecords?.find((row) => row.id === "A1-100")?.photos.length).toBeGreaterThan(0);
    expect(result.block.photoGroups?.some((group) => group.title.startsWith("TheCarApi · "))).toBe(true);
    expect(result.records.find((row) => row.id === "OL-55")?.fields.some((field) => field.key === "unknown_portal_code")).toBe(true);
    expect(result.block.hidePhotoWatermarks).toBe(false);
  });

  it("TheCarApi ielāde neieslēdz slēdzi, saglabāto true atstāj", async () => {
    const unsetScript = scripted([
      jsonResponse(200, hit),
      jsonResponse(200, { auctions: [detailAuto1] }),
      jsonResponse(200, { images: [] }),
      jsonResponse(200, imagesAuto1),
    ]);
    const unset = await fetchThecarapiCcVinMerge({
      vin: "WBA5R1C00LFH42883",
      deps: unsetScript.deps,
      fetchJpegs: async () => ({ ok: [], failed: [] }),
    });
    expect(unset.block.hidePhotoWatermarks).toBe(false);

    const keptScript = scripted([
      jsonResponse(200, hit),
      jsonResponse(200, { auctions: [detailAuto1] }),
      jsonResponse(200, { images: [] }),
      jsonResponse(200, imagesAuto1),
    ]);
    const kept = await fetchThecarapiCcVinMerge({
      vin: "WBA5R1C00LFH42884",
      prev: { ...emptyCcVinBlock(), hidePhotoWatermarks: true },
      deps: keptScript.deps,
      fetchJpegs: async () => ({ ok: [], failed: [] }),
    });
    expect(kept.block.hidePhotoWatermarks).toBe(true);
  });
});

/**
 * 27.11: TheCarApi BCA lote ar picture_count 44 - oriģinālās BCA saites 404, `auction-images`
 * rāda `pending: 44, count: 0`. Adminā jābūt statusam, un automātika vēlāk ielādē bildes.
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { fetchAuctionPhotoJpeg } from "@/lib/auction-photo-fetch";
import { fetchThecarapiCcVinMerge, retryThecarapiPendingPhotos } from "@/lib/thecarapi-cc-vin";
import { upsertThecarapiPhotoWaitEntries } from "@/lib/thecarapi-photo-wait-index";
import {
  isSafeThecarapiImageUrl,
  nextThecarapiPhotoWait,
  THECARAPI_PHOTO_MAX_ATTEMPTS,
  thecarapiPhotoWaitDue,
  thecarapiPhotoWaitLabel,
  type ThecarapiPhotoWait,
} from "@/lib/thecarapi-photo-wait";
import type { ThecarapiGalleryFetch } from "@/lib/thecarapi-photos";
import { readThecarapiPhotoWaitIndex } from "@/lib/vin-scan/store";
import type { ThecarapiDeps } from "@/lib/vin-scan/thecarapi-api";

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse("2026-11-27T08:00:00.000Z");

let dir = "";

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "thecarapi-foto-gaida-"));
  vi.stubEnv("VIN_SCAN_DIR", dir);
  vi.stubEnv("ADMIN_ORDER_DRAFT_DIR", dir);
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

const LOT = "778899";
const BCA_1 = "https://bcamediaprod.blob.core.windows.net/media/778899/1.jpg";
const BCA_2 = "https://bcamediaprod.blob.core.windows.net/media/778899/2.jpg";
/** TheCarApi krātuves hosts nav allowlistā - uzticamies, jo saite nāk no `auction-images`. */
const TC_1 = "https://media.thecarapi-storage.example/bca/778899/1.jpg";
const TC_2 = "https://media.thecarapi-storage.example/bca/778899/2.jpg";

function historyOf(lot: string) {
  return {
    auctions: [{ site_name: "bca", auction_id: lot, detail_path: `/api/auction/bca/${lot}`, first_seen: "2026-11-20", picture_count: 44 }],
  };
}
function detailOf(lot: string) {
  return { auction: { site_name: "bca", id: lot, picture_count: 44, images: [{ url: BCA_1 }, { url: BCA_2 }] } };
}
const history = historyOf(LOT);
const detail = detailOf(LOT);
const pending44 = { count: 0, pending: 44, images: [] };
const ready = { count: 2, pending: 0, images: [{ url: TC_1 }, { url: TC_2 }] };

/** BCA CDN = 404; TheCarApi krātuve atbild, ja saite ir uzticamo sarakstā. */
const cdn: ThecarapiGalleryFetch = async (urls, _max, _deadline, trusted) => ({
  ok: urls
    .filter((url) => url.startsWith("https://media.thecarapi-storage.example/") && trusted?.has(url))
    .map((url) => ({ ok: true as const, url, jpeg: Buffer.from(url), contentHash: `h-${url}` })),
  failed: urls
    .filter((url) => !url.startsWith("https://media.thecarapi-storage.example/"))
    .map((url) => ({ url, reason: "http_404" })),
});

describe("TheCarApi foto gaida avotu", () => {
  const vin = "WVWZZZAUZKW778899";
  const sessionId = "cs_test_fotoGaida1";

  it("pending + visas saites 404 → statuss «gaida», indeksā nākamais mēģinājums pēc 1 h", async () => {
    const { deps } = scripted([json(200, history), json(200, detail), json(200, pending44)]);
    const result = await fetchThecarapiCcVinMerge({ vin, sessionId, deps, fetchJpegs: cdn, writeJpeg: async () => undefined, now: T0 });
    const row = result.block.thecarapiRecords?.find((r) => r.id === LOT);
    expect(row?.photos).toHaveLength(0);
    expect(row?.photoWait).toMatchObject({ state: "pending", pending: 44, attempts: 0 });
    expect(row?.photoWait?.nextAt).toBe(new Date(T0 + HOUR).toISOString());
    expect(thecarapiPhotoWaitLabel(row?.photoWait)).toBe("Foto vēl tiek sagatavoti avotā (44) - mēģinās vēlreiz");
    expect(result.block.photoGroups ?? []).toHaveLength(0);
    const index = await readThecarapiPhotoWaitIndex();
    expect(index).toContainEqual(expect.objectContaining({ sessionId, vin, nextAt: new Date(T0 + HOUR).toISOString() }));

    // Pirms termiņa nekas netiek pieprasīts.
    const early = scripted([]);
    const none = await retryThecarapiPendingPhotos({ vin, prev: result.block, sessionId, now: T0 + 30 * 60 * 1000, deps: early.deps, fetchJpegs: cdn, writeJpeg: async () => undefined });
    expect(none.changed).toBe(false);
    expect(early.urls).toEqual([]);

    // Atkārtojums pēc 1 h: tikai bilžu saraksts, bildes no TheCarApi krātuves ielādētas.
    const again = scripted([json(200, ready)]);
    const writes: string[] = [];
    const retry = await retryThecarapiPendingPhotos({
      vin,
      prev: result.block,
      sessionId,
      now: T0 + HOUR + 60_000,
      deps: again.deps,
      fetchJpegs: cdn,
      writeJpeg: async (session) => {
        writes.push(session);
      },
    });
    expect(again.urls).toEqual([`https://api.thecarapi.com/api/auction-images/bca/${LOT}`]);
    expect(retry.changed).toBe(true);
    const done = retry.block.thecarapiRecords?.find((r) => r.id === LOT);
    expect(done?.photos.map((p) => p.sourceUrl)).toEqual([TC_1, TC_2]);
    expect(done?.photoWait).toBeUndefined();
    expect(retry.groups).toHaveLength(1);
    expect(retry.groups?.[0]?.photos).toHaveLength(2);
    expect(retry.block.photoGroups?.[0]?.title).toMatch(/^TheCarApi · /);
    expect(writes).toContain(sessionId);
    expect(writes).toContain(`tc${vin}`);
  });

  it("pēc 4 neveiksmīgiem atkārtojumiem - galīgs statuss «Avots bildes nepiegādāja»", async () => {
    const vin = "WVWZZZAUZKW778800";
    const LOT = "778800";
    const first = scripted([json(200, historyOf(LOT)), json(200, detailOf(LOT)), json(200, pending44)]);
    let block = (await fetchThecarapiCcVinMerge({ vin, sessionId, deps: first.deps, fetchJpegs: cdn, writeJpeg: async () => undefined, now: T0 })).block;
    const times = [1, 3, 12, 24].map((h) => T0 + h * HOUR + 60_000);
    for (const [i, now] of times.entries()) {
      const step = scripted([json(200, pending44)]);
      const res = await retryThecarapiPendingPhotos({ vin, prev: block, sessionId, now, deps: step.deps, fetchJpegs: cdn, writeJpeg: async () => undefined });
      expect(step.urls).toHaveLength(1);
      block = res.block;
      const wait = block.thecarapiRecords?.find((r) => r.id === LOT)?.photoWait;
      expect(wait?.attempts).toBe(i + 1);
      expect(wait?.state).toBe(i + 1 < THECARAPI_PHOTO_MAX_ATTEMPTS ? "pending" : "failed");
    }
    const wait = block.thecarapiRecords?.find((r) => r.id === LOT)?.photoWait;
    expect(thecarapiPhotoWaitLabel(wait)).toBe("Avots bildes nepiegādāja");
    // Galīgs: vairs neprasa.
    const after = scripted([]);
    const res = await retryThecarapiPendingPhotos({ vin, prev: block, sessionId, now: T0 + 48 * HOUR, deps: after.deps });
    expect(res.changed).toBe(false);
    expect(after.urls).toEqual([]);
  });
});

describe("foto gaidīšanas loģika", () => {
  it("grafiks 1/3/12/24 h no pirmās konstatēšanas; ar bildēm statusa nav", () => {
    const w0 = nextThecarapiPhotoWait({ storedPhotos: 0, pending: 44, retried: false, now: T0 })!;
    expect(w0.nextAt).toBe(new Date(T0 + HOUR).toISOString());
    const w1 = nextThecarapiPhotoWait({ storedPhotos: 0, pending: 40, prev: w0, retried: true, now: T0 + HOUR })!;
    expect(w1).toMatchObject({ state: "pending", attempts: 1, pending: 40, nextAt: new Date(T0 + 3 * HOUR).toISOString() });
    expect(thecarapiPhotoWaitDue(w1, T0 + 2 * HOUR)).toBe(false);
    expect(thecarapiPhotoWaitDue(w1, T0 + 3 * HOUR)).toBe(true);
    expect(nextThecarapiPhotoWait({ storedPhotos: 3, pending: 40, prev: w1, retried: true, now: T0 })).toBeUndefined();
    expect(nextThecarapiPhotoWait({ storedPhotos: 0, pending: 0, retried: false, now: T0 })).toBeUndefined();
    const failed: ThecarapiPhotoWait = { state: "failed", pending: 44, attempts: 4, firstAt: new Date(T0).toISOString() };
    expect(thecarapiPhotoWaitDue(failed, T0 + 99 * HOUR)).toBe(false);
  });

  it("indekss: pieliek, atjauno un izņem pasūtījumu", () => {
    const wait = nextThecarapiPhotoWait({ storedPhotos: 0, pending: 5, retried: false, now: T0 });
    const added = upsertThecarapiPhotoWaitEntries([], "s1", "WVWZZZAUZKW778899", [wait], T0)!;
    expect(added).toHaveLength(1);
    expect(upsertThecarapiPhotoWaitEntries(added, "s1", "WVWZZZAUZKW778899", [wait], T0)).toBeNull();
    expect(upsertThecarapiPhotoWaitEntries(added, "s1", "WVWZZZAUZKW778899", [undefined], T0)).toEqual([]);
    expect(upsertThecarapiPhotoWaitEntries([], "s2", "WVWZZZAUZKW778899", [undefined], T0)).toBeNull();
  });

  it("uzticamā TheCarApi saite: tikai publisks https", () => {
    expect(isSafeThecarapiImageUrl(TC_1)).toBe(true);
    expect(isSafeThecarapiImageUrl("http://media.thecarapi-storage.example/a.jpg")).toBe(false);
    expect(isSafeThecarapiImageUrl("https://127.0.0.1/a.jpg")).toBe(false);
    expect(isSafeThecarapiImageUrl("https://10.0.0.5/a.jpg")).toBe(false);
    expect(isSafeThecarapiImageUrl("https://localhost/a.jpg")).toBe(false);
    expect(isSafeThecarapiImageUrl("https://user:pw@media.example.com/a.jpg")).toBe(false);
    expect(isSafeThecarapiImageUrl("https://metadata.internal/a.jpg")).toBe(false);
  });
});

describe("lejupielāde no TheCarApi krātuves (hosts ārpus allowlist)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uzticama saite ar image/* ielādējas; bez uzticības - host_not_allowed; ne-bilde - not_image", async () => {
    const jpeg = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#445566" } }).jpeg().toBuffer();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/page.html")) return new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
        return new Response(new Uint8Array(jpeg), { status: 200, headers: { "Content-Type": "image/jpeg" } });
      }),
    );
    const trusted = new Set([TC_1, "https://media.thecarapi-storage.example/page.html"]);
    expect((await fetchAuctionPhotoJpeg(TC_1, 320 * 1024, undefined, trusted)).ok).toBe(true);
    expect(await fetchAuctionPhotoJpeg(TC_1, 320 * 1024)).toMatchObject({ ok: false, reason: "host_not_allowed" });
    expect(await fetchAuctionPhotoJpeg(TC_2, 320 * 1024, undefined, trusted)).toMatchObject({ ok: false, reason: "host_not_allowed" });
    expect(
      await fetchAuctionPhotoJpeg("https://media.thecarapi-storage.example/page.html", 320 * 1024, undefined, trusted),
    ).toMatchObject({ ok: false, reason: "not_image" });
  });
});

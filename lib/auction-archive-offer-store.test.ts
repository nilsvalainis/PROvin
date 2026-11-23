import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  put: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  del: vi.fn(async () => undefined),
  list: vi.fn(async () => ({ blobs: [] })),
}));

const SID = "cs_test_archive_1";
const ph = (n: number) => `ih_ph_${String(n).padStart(24, "0")}`;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

async function jpeg(color: string): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: color } }).jpeg().toBuffer();
}

const summary = { vin: "WAUZZZF43PA018831", title: "Audi A4", auctions: [], photoCount: 2, manualSources: [] };

describe("izsoļu arhīva krātuve", () => {
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "auction-archive-"));
    vi.stubEnv("ADMIN_ORDER_DRAFT_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  const load = () => import("@/lib/auction-archive-offer-store");

  it("izveide: tokens netiek saglabāts, atrod pēc tokena, cits tokens neder", async () => {
    const s = await load();
    const r = await s.createAuctionArchiveOffer({
      sessionId: SID,
      locale: "lv",
      channel: "email",
      paidCents: 2499,
      summary,
      photos: [{ id: ph(1), auctionKey: "openlane:1", date: "2026-10-21", caption: "" }],
      photosMissing: 0,
      previewIds: [ph(1), ph(99)],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.doc.previewIds).toEqual([ph(1)]);
    const all = walk(dir).map((f) => readFileSync(f, "utf8")).join("\n");
    expect(all).not.toContain(r.token);
    expect(all).toContain(s.hashAuctionArchiveToken(r.token));

    const found = await s.findAuctionArchiveOfferByToken(r.token);
    expect(found?.sessionId).toBe(SID);
    expect(await s.findAuctionArchiveOfferByToken("B".repeat(43))).toBeNull();
    expect(await s.findAuctionArchiveOfferByToken("../../etc")).toBeNull();
  });

  it("atkārtots piedāvājums: vecā saite vairs neder; pēc izvēles jaunu neizveido", async () => {
    const s = await load();
    const input = { sessionId: SID, locale: "lv" as const, channel: "email" as const, paidCents: 2499, summary, photos: [], photosMissing: 0, previewIds: [] };
    const a = await s.createAuctionArchiveOffer(input);
    const b = await s.createAuctionArchiveOffer({ ...input, channel: "whatsapp" });
    if (!a.ok || !b.ok) throw new Error("create");
    expect(await s.findAuctionArchiveOfferByToken(a.token)).toBeNull();
    expect((await s.findAuctionArchiveOfferByToken(b.token))?.doc.history.map((h) => h.event)).toEqual(["offer_sent", "offer_sent"]);
    // Vecā tokena indekss izdzēsts.
    expect(walk(path.join(dir, "auction_archive_offer_tokens"))).toHaveLength(1);

    await s.updateAuctionArchiveOffer(SID, (cur) => ({ next: { ...cur!, status: "chose_archive", choice: "archive" }, result: null }));
    const c = await s.createAuctionArchiveOffer(input);
    expect(c).toEqual({ ok: false, error: "already_chosen" });
    expect(walk(path.join(dir, "auction_archive_offer_tokens"))).toHaveLength(1);
  });

  it("bildes: kopija pasūtījuma mapē, izplūdinātā bilde, saraksts cron, dzēšana visu noņem", async () => {
    const s = await load();
    const photos = await import("@/lib/auction-archive-offer-photos");
    const red = await jpeg("#c00000");
    const stored = new Map([["tcWAUZZZF43PA018831/" + ph(1), red]]);
    const fetched: string[] = [];
    const res = await photos.persistAuctionArchivePhotos({
      sessionId: SID,
      sources: [
        { id: ph(1), auctionKey: "openlane:1", date: "2026-10-21", caption: "a", stored: { sessionId: "tcWAUZZZF43PA018831", photoId: ph(1) } },
        { id: ph(2), auctionKey: "openlane:1", date: "2026-10-21", caption: "b", url: "https://cdn.example/b.jpg" },
        { id: ph(3), auctionKey: "openlane:1", date: "2026-10-21", caption: "c", url: "https://cdn.example/gone.jpg" },
      ],
      deps: {
        readStored: async (sid, id) => stored.get(`${sid}/${id}`) ?? null,
        fetchUrls: async (urls) => {
          fetched.push(...urls);
          return { ok: urls.filter((u) => u.endsWith("b.jpg")).map((url) => ({ url, jpeg: red })) };
        },
      },
    });
    expect(res.photos.map((p) => p.id)).toEqual([ph(1), ph(2)]);
    expect(res.missing).toBe(1);
    expect(fetched).toEqual(["https://cdn.example/b.jpg", "https://cdn.example/gone.jpg"]);
    expect(await s.readAuctionArchivePhoto(SID, ph(2))).not.toBeNull();

    // Atkārtoti: jau nokopētās nelasa no avota.
    const again = await photos.persistAuctionArchivePhotos({
      sessionId: SID,
      sources: [{ id: ph(1), auctionKey: "x", date: "", caption: "" }],
      deps: { readStored: async () => null, fetchUrls: async () => ({ ok: [] }) },
    });
    expect(again.photos).toHaveLength(1);

    const ids = await photos.writeAuctionArchivePreviews({ sessionId: SID, previewIds: [ph(2), ph(1), ph(3)] });
    expect(ids).toEqual([ph(2), ph(1)]);
    const prev = await s.readAuctionArchivePreview(SID, 0);
    expect(prev).not.toBeNull();
    const meta = await sharp(prev!).metadata();
    expect(meta.width).toBe(560);
    expect(await s.readAuctionArchivePreview(SID, 2)).toBeNull();

    const created = await s.createAuctionArchiveOffer({
      sessionId: SID,
      locale: "lv",
      channel: "email",
      paidCents: null,
      summary,
      photos: res.photos,
      photosMissing: res.missing,
      previewIds: ids,
    });
    expect(created.ok).toBe(true);
    expect(await s.listAuctionArchiveOfferSessionIds()).toEqual([SID]);

    await s.deleteAuctionArchiveOffer(SID);
    expect(walk(dir)).toEqual([]);
  });

  it("noklusējuma priekšskatījums: pirmā + odometrs", async () => {
    const photos = await import("@/lib/auction-archive-offer-photos");
    const list = [
      { id: ph(1), auctionKey: "a", date: "", caption: "Priekšpuse" },
      { id: ph(2), auctionKey: "a", date: "", caption: "Aizmugure" },
      { id: ph(3), auctionKey: "a", date: "", caption: "Odometrs" },
    ];
    expect(photos.defaultAuctionArchivePreviewIds(list)).toEqual([ph(1), ph(3)]);
    expect(photos.defaultAuctionArchivePreviewIds(list.slice(0, 2))).toEqual([ph(1), ph(2)]);
    expect(photos.defaultAuctionArchivePreviewIds([])).toEqual([]);
  });

  it("bilžu saraksts: TheCarApi hronoloģiski, CDN saites, manuālās grupas bez dublikātiem", async () => {
    const photos = await import("@/lib/auction-archive-offer-photos");
    const base = { venue: "Openlane", fields: [], raw: null, rawHistory: null, rawDetail: null, rawImages: null };
    const out = photos.collectAuctionArchivePhotoSources({
      vin: "WAUZZZF43PA018831",
      sessionId: SID,
      block: {
        thecarapiRecords: [
          { ...base, site: "bca", id: "2", date: "2026-10-22", photoDate: "2026-10-22", photoUrls: ["https://c/2.jpg"], photos: [] },
          {
            ...base,
            site: "openlane",
            id: "1",
            date: "2026-10-21",
            photoDate: "2026-10-21",
            photoUrls: ["https://c/1.jpg", "https://c/1b.jpg"],
            photos: [{ id: ph(1), sourceUrl: "https://c/1.jpg", contentHash: "h", date: "2026-10-21", venue: "", caption: "TheCarApi · Openlane · 21.10.2026" }],
          },
        ],
        photoGroups: [
          { id: "g", title: "TheCarApi · Openlane", photos: [{ id: ph(7), sourceUrl: "https://c/1.jpg", contentHash: "h" }] },
          { id: "m", title: "checkcar.vin 12.05.2024", photos: [{ id: ph(8) }] },
        ],
      },
    });
    expect(out.map((s) => s.auctionKey)).toEqual(["openlane:1", "openlane:1", "bca:2", "manual"]);
    expect(out[0]).toMatchObject({ id: ph(1), stored: { sessionId: "tcWAUZZZF43PA018831", photoId: ph(1) }, caption: "Openlane · 21.10.2026" });
    expect(out[1]!.url).toBe("https://c/1b.jpg");
    expect(out[3]).toMatchObject({ id: ph(8), date: "2024-05-12", stored: { sessionId: SID, photoId: ph(8) } });
  });
});

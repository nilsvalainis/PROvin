import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const sbp = new Map<string, Buffer>();
const ih = new Map<string, Buffer>();
let seq = 0;
const hex = () => String(++seq).padStart(24, "0");

vi.mock("@/lib/admin-source-block-photo-store", () => ({
  makeSourceBlockPhotoId: () => `sbp_ph_${hex()}`,
  readSourceBlockPhotoJpeg: async (_s: string, id: string) => sbp.get(id) ?? null,
  writeSourceBlockPhotoJpeg: async (_s: string, id: string, b: Buffer) => void sbp.set(id, b),
}));
vi.mock("@/lib/admin-cc-vin-photo-store", () => ({
  makeCcVinPhotoId: () => `ih_ph_${hex()}`,
  readCcVinPhotoJpeg: async (_s: string, id: string) => ih.get(id) ?? null,
  writeCcVinPhotoJpeg: async (_s: string, id: string, b: Buffer) => void ih.set(id, b),
}));

import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { importVendorArchiveGroups } from "@/lib/vendor-archive-photos-import";
import { parseRelayArchivePhotos } from "@/lib/vendor-archive-relay";
import {
  archiveDateLabel,
  collectDomPhotoEntries,
  collectJsonPhotoEntries,
  domPhotoShapesSummary,
  downloadArchivePhotos,
  groupPhotoEntries,
  isAllowedPhotoUrl,
  largestFromSrcset,
  looksLikeImageUrl,
  photoKeyPathsSummary,
  photoUrlShape,
  pickReportPageHref,
  upgradedImageUrls,
} from "@/relay/provin-carvertical/lib/archive-photos.mjs";
import { buildDebugBody } from "@/relay/provin-carvertical/lib/cv-page.mjs";
import { createRelayCore as createCvCore } from "@/relay/provin-carvertical/lib/relay-core.mjs";
import { createRelayCore as createDnaCore } from "@/relay/provin-autodna/lib/relay-core.mjs";

const VIN = "WVWZZZ1JZXW000001";

async function photo(seed: number, w = 400): Promise<Buffer> {
  const h = Math.round(w * 0.55);
  const bg = { r: (seed * 53) % 255, g: (seed * 97) % 255, b: (seed * 151) % 255 };
  const svg = `<svg width="400" height="220"><rect x="${(seed * 37) % 300}" y="${(seed * 23) % 150}" width="80" height="60" fill="#fff"/><circle cx="${300 - ((seed * 31) % 100)}" cy="110" r="40" fill="#203040"/></svg>`;
  const base = await sharp({ create: { width: 400, height: 220, channels: 3, background: bg } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  return sharp(base).resize(w, h, { fit: "fill" }).jpeg({ quality: 90 }).toBuffer();
}

describe("releja arhīva foto: tīrā loģika (abos relejos tas pats fails)", () => {
  it("fails relejos identisks", () => {
    const a = fs.readFileSync("relay/provin-carvertical/lib/archive-photos.mjs", "utf8");
    const b = fs.readFileSync("relay/provin-autodna/lib/archive-photos.mjs", "utf8");
    expect(a).toBe(b);
  });

  it("tikai https publiski hosti", () => {
    expect(isAllowedPhotoUrl("https://cdn.carvertical.com/a/b.jpg")).toBe(true);
    expect(isAllowedPhotoUrl("http://cdn.carvertical.com/a.jpg")).toBe(false);
    expect(isAllowedPhotoUrl("https://127.0.0.1/a.jpg")).toBe(false);
    expect(isAllowedPhotoUrl("https://localhost/a.jpg")).toBe(false);
    expect(isAllowedPhotoUrl("https://user:pw@x.example/a.jpg")).toBe(false);
  });

  it("datumi: CarVertical mēnesis, AutoDNA diena", () => {
    expect(archiveDateLabel("2020-07-15T10:00:00Z")).toBe("07.2020");
    expect(archiveDateLabel("2024-11-12", "day")).toBe("12.11.2024");
    expect(archiveDateLabel("12.11.2024", "day")).toBe("12.11.2024");
    expect(archiveDateLabel("12.11.2024")).toBe("11.2024");
    expect(archiveDateLabel("nav")).toBe("");
    expect(largestFromSrcset("https://x.example/a.jpg 400w, https://x.example/b.jpg 1600w")).toBe("https://x.example/b.jpg");
  });

  it("JSON: lielākais variants + tuvākais datums, dublikāti izmesti", () => {
    const json = {
      vin: VIN,
      sections: {
        photos: {
          total: 3,
          groups: [
            { date: "2020-07-01", images: [{ thumbnail: "https://img.example/t1.jpg", original: "https://img.example/o1.jpg" }, { url: "https://img.example/o2.jpg" }] },
            { createdAt: "2022-01-03T00:00:00Z", images: ["https://img.example/o3.jpg", "https://img.example/o1.jpg"] },
          ],
        },
      },
      logo: "http://insecure.example/logo.png",
    };
    const entries = collectJsonPhotoEntries(json);
    expect(entries).toEqual([
      { url: "https://img.example/o1.jpg", date: "07.2020" },
      { url: "https://img.example/o2.jpg", date: "07.2020" },
      { url: "https://img.example/o3.jpg", date: "01.2022" },
    ]);
    expect(groupPhotoEntries(entries).map((g) => [g.date, g.urls.length])).toEqual([
      ["07.2020", 2],
      ["01.2022", 1],
    ]);
  });

  it("CDN saites bez paplašinājuma: der, ja atslēga vai hosts norāda uz bildi; PDF / HTML - nē", () => {
    expect(looksLikeImageUrl("https://x.example/a/b/c")).toBe(false);
    expect(looksLikeImageUrl("https://x.example/a/b/c", "photoUrl")).toBe(true);
    expect(looksLikeImageUrl("https://images.example.net/abc123")).toBe(true);
    expect(looksLikeImageUrl("https://x.example/report.pdf", "photo")).toBe(false);
    const json = {
      report: {
        listings: [
          { listedAt: "2020-07-10", media: [{ id: 1, location: "https://x.example/m/1" }, { id: 2, location: "https://x.example/m/2" }] },
          { listedAt: "2022-01-03", photos: ["https://x.example/m/3"] },
        ],
        sellerUrl: "https://dealer.example/car",
      },
    };
    expect(collectJsonPhotoEntries(json)).toEqual([
      { url: "https://x.example/m/1", date: "07.2020" },
      { url: "https://x.example/m/2", date: "07.2020" },
      { url: "https://x.example/m/3", date: "01.2022" },
    ]);
    expect(photoKeyPathsSummary(json)).toEqual(["report.listings[].media[].location × 2", "report.listings[].photos[] × 1"]);
  });

  it("atskaites lapas saite pēc reportId no «Manas atskaites»", () => {
    const origin = "https://www.carvertical.com";
    const links = [
      { href: "https://www.carvertical.com/lv/user/reports", text: "Atskaites" },
      { href: "https://www.carvertical.com/lv/precheck/pricing?r=abc-123", text: "Pirkt" },
      { href: "/lv/report/abc-123/pdf", text: "PDF" },
      { href: "/lv/report/abc-123", text: "Priekšskatījums" },
      { href: "https://evil.example/lv/report/abc-123", text: "Priekšskatījums" },
    ];
    expect(pickReportPageHref(links, "abc-123", origin)).toBe("https://www.carvertical.com/lv/report/abc-123");
    expect(pickReportPageHref(links, "zzz", origin)).toBe("");
  });

  it("AutoDNA DOM: saite uz pilno bildi > srcset > src, datums no virsraksta", () => {
    const entries = collectDomPhotoEntries([
      { type: "date", text: "12.11.2024" },
      { type: "img", href: "https://www.autodna.lv/foto/full1.jpg", src: "https://www.autodna.lv/foto/thumb1.jpg" },
      { type: "img", srcset: "https://www.autodna.lv/foto/s2.jpg 215w, https://www.autodna.lv/foto/l2.jpg 1200w", src: "https://www.autodna.lv/foto/s2.jpg" },
      { type: "date", text: "Datums: 03.01.2022" },
      { type: "img", href: "https://www.autodna.lv/vin/xyz", src: "https://www.autodna.lv/foto/3.jpg" },
      { type: "img", src: "data:image/png;base64,AAAA" },
    ]);
    expect(entries).toEqual([
      { url: "https://www.autodna.lv/foto/full1.jpg", date: "12.11.2024", fallbacks: ["https://www.autodna.lv/foto/thumb1.jpg"] },
      { url: "https://www.autodna.lv/foto/l2.jpg", date: "12.11.2024", fallbacks: ["https://www.autodna.lv/foto/s2.jpg"] },
      { url: "https://www.autodna.lv/foto/3.jpg", date: "03.01.2022", fallbacks: [] },
    ]);
  });

  it("sīktēla saite -> lielā varianta kandidāti", () => {
    expect(upgradedImageUrls("https://img.example.com/photos/thumb/abc_thumb.jpg?w=300&h=200&v=2")).toEqual([
      "https://img.example.com/photos/original/abc.jpg?v=2",
      "https://img.example.com/photos/abc.jpg?v=2",
      "https://img.example.com/photos/thumb/abc.jpg?v=2",
      "https://img.example.com/photos/large/abc.jpg?v=2",
      "https://img.example.com/photos/thumb/abc_thumb.jpg?v=2",
    ]);
    expect(upgradedImageUrls("https://cdn.example.com/a/300x200/b.jpg")).toEqual(["https://cdn.example.com/a/b.jpg"]);
    expect(upgradedImageUrls("https://cdn.example.com/a/b-640x480.webp")).toEqual(["https://cdn.example.com/a/b.webp"]);
    expect(upgradedImageUrls("https://cdn.example.com/a/b.jpg")).toEqual([]);
    expect(upgradedImageUrls("http://cdn.example.com/thumb/b.jpg")).toEqual([]);
  });

  it("AutoDNA DOM: lightbox data-remote pirms sīktēla, sīktēls paliek pēdējā rezerve", () => {
    const [e] = collectDomPhotoEntries([
      { type: "date", text: "05.06.2021" },
      { type: "img", dataRemote: "https://photos.autodna.example/o/12345678.jpg", src: "https://photos.autodna.example/thumb/12345678_thumb.jpg?w=200" },
    ]);
    expect(e.url).toBe("https://photos.autodna.example/o/12345678.jpg");
    expect(e.date).toBe("05.06.2021");
    expect(e.fallbacks[0]).toBe("https://photos.autodna.example/original/12345678.jpg");
    expect(e.fallbacks.at(-1)).toBe("https://photos.autodna.example/thumb/12345678_thumb.jpg?w=200");
    expect(e.fallbacks.length).toBeLessThanOrEqual(5);
  });

  it("debug formas bez vērtībām", () => {
    expect(photoUrlShape("https://cdn.example.com/p/a1b2c3d4e5f6g7h8.jpg?w=300&sig=x")).toBe("cdn.example.com/p/*.jpg?w&sig");
    expect(domPhotoShapesSummary([{ type: "img", src: "https://cdn.example.com/t/1.jpg", attrs: "img@src" }])).toEqual(["src=cdn.example.com/t/1.jpg ; attrs=img@src"]);
  });
});

/** Viltus Playwright lapa: `inPage` - lapas fetch (CORS), `ctx` - konteksta pieprasījums. */
function fakePage(files: Record<string, Buffer>, { corsBlocked = [] as string[] } = {}) {
  const calls: string[] = [];
  const res = (url: string) => {
    const b = files[url];
    return b ? { ok: true, contentType: "image/jpeg", size: b.length, base64: b.toString("base64") } : { ok: false, status: 404 };
  };
  return {
    calls,
    url: () => "https://www.autodna.lv/vin/X/slug/tok/autodna_vhr",
    async evaluate(_fn: unknown, arg: { url: string }) {
      calls.push(`page ${arg.url}`);
      if (corsBlocked.some((h) => arg.url.includes(h))) return { ok: false, status: 0 };
      return res(arg.url);
    },
    context: () => ({
      request: {
        async get(url: string) {
          calls.push(`ctx ${url}`);
          const b = files[url];
          return { ok: () => Boolean(b), status: () => (b ? 200 : 404), headers: () => ({ "content-type": "image/jpeg" }), body: async () => b ?? Buffer.alloc(0) };
        },
      },
    }),
  };
}

describe("releja arhīva foto: lejupielāde lielais -> sīktēls", () => {
  it("lielais variants, ja ir; citādi sīktēls; CORS -> konteksta pieprasījums", async () => {
    const big = await photo(1, 1600);
    const thumb = await photo(2, 300);
    const page = fakePage(
      { "https://big.example.com/a.jpg": big, "https://www.autodna.lv/t/b.jpg": thumb, "https://www.autodna.lv/t/c.jpg": thumb },
      { corsBlocked: ["big.example.com"] },
    );
    const groups = await downloadArchivePhotos(page, [
      { url: "https://big.example.com/a.jpg", date: "01.02.2020", fallbacks: ["https://www.autodna.lv/t/a.jpg"] },
      { url: "https://www.autodna.lv/o/b.jpg", date: "01.02.2020", fallbacks: ["https://www.autodna.lv/t/b.jpg"] },
      { url: "https://www.autodna.lv/o/c.jpg", date: "03.04.2021", fallbacks: ["https://www.autodna.lv/t/c.jpg"] },
    ]);
    expect(groups.map((g) => [g.date, g.photos.map((p) => p.url)])).toEqual([
      ["01.02.2020", ["https://big.example.com/a.jpg", "https://www.autodna.lv/t/b.jpg"]],
      ["03.04.2021", ["https://www.autodna.lv/t/c.jpg"]],
    ]);
    expect(Buffer.from(groups[0].photos[0].base64, "base64").equals(big)).toBe(true);
    expect(page.calls).toContain("ctx https://big.example.com/a.jpg");
    // 404 lapā -> konteksta pieprasījumu nemēģina
    expect(page.calls).not.toContain("ctx https://www.autodna.lv/o/b.jpg");
  });

  it("pēc laika budžeta mēģina tikai vienu variantu", async () => {
    const thumb = await photo(3, 300);
    const page = fakePage({ "https://www.autodna.lv/t/a.jpg": thumb });
    let t = 0;
    const groups = await downloadArchivePhotos(
      page,
      [{ url: "https://www.autodna.lv/o/a.jpg", date: "", fallbacks: ["https://www.autodna.lv/t/a.jpg"] }],
      { budgetMs: 10, now: () => (t += 100) },
    );
    expect(groups[0].photos[0].url).toBe("https://www.autodna.lv/t/a.jpg");
    expect(page.calls).toEqual(["page https://www.autodna.lv/t/a.jpg"]);
  });
});

function cvBrowser(reports: { id: string; vin: string; status: number; createdAt: string }[]) {
  const calls: string[] = [];
  return {
    calls,
    async peekSession() {
      calls.push("peek");
      return { state: "active" };
    },
    async ensureSession() {
      calls.push("ensure");
      return { state: "active" };
    },
    async account() {
      calls.push("account");
      return { credits: 5, reports: reports.map((r) => ({ ...r, finishedAt: "", expiresAt: "" })), listRead: true };
    },
    async purchase() {
      calls.push("purchase");
      return { ok: true, clicked: true };
    },
    async downloadPdf() {
      calls.push("pdf");
      return { ok: false };
    },
    async reportPhotos(id: string) {
      calls.push(`photos:${id}`);
      return { ok: true, groups: [{ date: "07.2020", photos: [{ base64: "AAAA", contentType: "image/jpeg", url: "https://x.example/1.jpg" }] }] };
    },
  };
}

describe("CarVertical debug fails", () => {
  it("lapas tekstā cipari aizkrāsoti, `extra` statusi redzami; tokens un e-pasts izņemti visur", () => {
    const body = JSON.parse(
      buildDebugBody(
        { url: "https://www.carvertical.com/lv/user/reports?p=2", labels: ["WAUZZZ4G5JN018732", "x\u0007y"], text: "Audi A6 WAUZZZ4G5JN018732 n@x.lv" },
        { direct: ["GET /reports/{id} -> 404", "GET /reports/{id}/data -> 200 keys: id,vin"], token: "Bearer abcdefghijklmnop", mail: "n@x.lv", secret: "SLEPENS-1234" },
        ["SLEPENS-1234"],
      ),
    );
    expect(body.text).toBe("Audi A# WAUZZZ#G#JN###### ***@***");
    expect(body.labels[0]).toBe("WAUZZZ#G#JN######");
    expect(body.url).toContain("p=#");
    expect(body.extra.direct).toEqual(["GET /reports/{id} -> 404", "GET /reports/{id}/data -> 200 keys: id,vin"]);
    expect(body.extra.token).toBe("Bearer ***");
    expect(body.extra.mail).toBe("***@***");
    expect(body.extra.secret).toBe("***");
  });
});

describe("releja arhīva foto: nekad nepērk", () => {
  it("CarVertical: nopirkta atskaite -> foto; nav atskaites -> not_found, pirkums netiek saukts", async () => {
    const b = cvBrowser([{ id: "r1", vin: VIN, status: 30, createdAt: "2026-11-01" }]);
    const core = createCvCore({ browser: b, notify: async () => undefined, now: () => new Date("2026-11-25T10:00:00Z") });
    const ok = await core.reportPhotos(VIN);
    expect(ok.status).toBe("ok");
    expect(b.calls).toEqual(["peek", "account", "photos:r1"]);
    const empty = cvBrowser([]);
    const core2 = createCvCore({ browser: empty, notify: async () => undefined });
    expect((await core2.reportPhotos(VIN)).status).toBe("not_found");
    expect((await core2.reportPhotos("123")).status).toBe("invalid_vin");
    expect(empty.calls).not.toContain("purchase");
    expect(empty.calls).not.toContain("ensure");
  });

  it("AutoDNA: tikai ja report_bought; citādi not_found bez pirkuma / priekšpārbaudes", async () => {
    const mk = (bought: boolean) => {
      const calls: string[] = [];
      return {
        calls,
        async peekSession() {
          calls.push("peek");
          return { state: "active" };
        },
        async ensureSession() {
          calls.push("ensure");
          return { state: "active" };
        },
        async account(vin = "") {
          calls.push(`account:${vin}`);
          return { credits: 3, bought };
        },
        async purchase() {
          calls.push("purchase");
          return { ok: true, clicked: true };
        },
        async precheck() {
          calls.push("precheck");
          return { allowed: true, photos: 1, history: 1 };
        },
        async reportPhotos(vin: string) {
          calls.push(`photos:${vin}`);
          return { ok: true, groups: [] };
        },
      };
    };
    const b = mk(true);
    const core = createDnaCore({ browser: b, notify: async () => undefined });
    expect((await core.reportPhotos(VIN)).status).toBe("no_photos");
    expect(b.calls).toEqual(["peek", `account:${VIN}`, `photos:${VIN}`]);
    const nb = mk(false);
    const core2 = createDnaCore({ browser: nb, notify: async () => undefined });
    expect((await core2.reportPhotos(VIN)).status).toBe("not_found");
    expect(nb.calls).toEqual(["peek", `account:${VIN}`]);
  });
});

describe("PROVIN: releja bildes aizstāj PDF sīktēlus", () => {
  beforeEach(() => {
    sbp.clear();
    ih.clear();
  });

  it("parseRelayArchivePhotos: tikai image/*, normalizē JPEG, vienāds datums -> viena grupa", async () => {
    const big = await photo(1, 1200);
    const groups = await parseRelayArchivePhotos({
      status: "ok",
      groups: [
        { date: "07.2020", photos: [{ base64: big.toString("base64"), contentType: "image/jpeg" }, { base64: "PHN2Zz4=", contentType: "image/svg+xml" }] },
        { date: "07.2020", photos: [{ base64: (await sharp(await photo(2, 900)).png().toBuffer()).toString("base64"), contentType: "image/png" }] },
      ],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.photos).toHaveLength(2);
    expect(groups[0]!.photos[1]!.jpeg.subarray(0, 2).toString("hex")).toBe("ffd8");
  });

  it("tā pati bilde lielākā izšķirtspējā -> tas pats id pārrakstīts, grupa «pilnas bildes»; jaunas pievieno", async () => {
    const blocks = mergeSourceBlocksWithDefaults({});
    const small = await photo(3, 400);
    const pdf = await importVendorArchiveGroups({
      sessionId: "cs_test_relay_1",
      source: "carvertical",
      via: "pdf",
      groups: [{ date: "07.2020", photos: [{ jpeg: small, width: 400, height: 220 }] }],
      sourceBlocks: blocks,
    });
    const id = pdf.tirgus.photoGroups[0]!.photos[0]!.id;
    const big = await photo(3, 1400);
    const relay = await importVendorArchiveGroups({
      sessionId: "cs_test_relay_1",
      source: "carvertical",
      via: "relay",
      groups: [{ date: "07.2020", photos: [{ jpeg: big, width: 1400, height: 770 }, { jpeg: await photo(4, 1400), width: 1400, height: 770 }] }],
      sourceBlocks: { ...blocks, tirgus: pdf.tirgus },
    });
    expect(relay.upgraded).toBe(1);
    expect(relay.added).toBe(1);
    expect(sbp.get(id)).toBe(big);
    const g = relay.tirgus.photoGroups[0]!;
    expect(g.photos.map((p) => p.id)[0]).toBe(id);
    expect(g.photos).toHaveLength(2);
    expect(g.archive?.via).toBe("relay");
    // Otrreiz: nekas nemainās (jau pilnas bildes).
    const again = await importVendorArchiveGroups({
      sessionId: "cs_test_relay_1",
      source: "carvertical",
      via: "relay",
      groups: [{ date: "07.2020", photos: [{ jpeg: big, width: 1400, height: 770 }] }],
      sourceBlocks: { ...blocks, tirgus: relay.tirgus },
    });
    expect(again.upgraded).toBe(0);
    expect(again.changed).toBe(false);
  });
});

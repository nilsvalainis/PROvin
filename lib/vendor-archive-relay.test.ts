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
  groupPhotoEntries,
  isAllowedPhotoUrl,
  largestFromSrcset,
} from "@/relay/provin-carvertical/lib/archive-photos.mjs";
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
      { url: "https://www.autodna.lv/foto/full1.jpg", date: "12.11.2024" },
      { url: "https://www.autodna.lv/foto/l2.jpg", date: "12.11.2024" },
      { url: "https://www.autodna.lv/foto/3.jpg", date: "03.01.2022" },
    ]);
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

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
import { importVendorArchiveGroups, moveVendorArchiveGroup } from "@/lib/vendor-archive-photos-import";

async function photo(seed: number, w = 400): Promise<Buffer> {
  const bg = { r: (seed * 53) % 255, g: (seed * 97) % 255, b: (seed * 151) % 255 };
  const svg = `<svg width="${w}" height="220"><rect x="${(seed * 37) % 300}" y="${(seed * 23) % 150}" width="80" height="60" fill="#fff"/><circle cx="${300 - ((seed * 31) % 100)}" cy="110" r="40" fill="#203040"/></svg>`;
  return sharp({ create: { width: w, height: 220, channels: 3, background: bg } }).composite([{ input: Buffer.from(svg) }]).jpeg().toBuffer();
}
const ex = (jpeg: Buffer) => ({ jpeg, width: 400, height: 220 });
const SID = "cs_test_archive_photos_1";

describe("vendor-archive-photos-import", () => {
  beforeEach(() => {
    sbp.clear();
    ih.clear();
  });

  it("dedup iekš importa un pret esošo; atkārtots imports neko nepievieno", async () => {
    const blocks = mergeSourceBlocksWithDefaults({});
    const p1 = await photo(1);
    const p2 = await photo(2);
    const p1b = await sharp(p1).resize(380).jpeg({ quality: 55 }).toBuffer();
    const groups = [
      { date: "07.2020", photos: [ex(p1), ex(p2)] },
      { date: "07.2020", photos: [ex(p1b), ex(await photo(3))] },
    ];
    const r1 = await importVendorArchiveGroups({ sessionId: SID, source: "carvertical", via: "pdf", groups, sourceBlocks: blocks });
    expect(r1.added).toBe(3);
    expect(r1.duplicates).toBe(1);
    expect(r1.tirgus.photoGroups).toHaveLength(1);
    expect(r1.tirgus.photoGroups[0]).toMatchObject({ title: "07.2020", archive: { source: "carvertical", date: "07.2020", via: "pdf" } });
    expect(Object.keys(r1.tirgus.photoGroups[0]!.archive!.hashes!)).toHaveLength(3);
    expect(r1.tirgus.photos).toHaveLength(3);

    const again = await importVendorArchiveGroups({
      sessionId: SID,
      source: "carvertical",
      via: "pdf",
      groups,
      sourceBlocks: mergeSourceBlocksWithDefaults({ ...blocks, tirgus: r1.tirgus }),
    });
    expect(again.added).toBe(0);
    expect(again.changed).toBe(false);
    expect(again.duplicates).toBe(4);
  });

  it("pārvieto uz izsoļu arhīvu un atpakaļ; meta un hash ceļo līdzi; dedup ņem vērā arī izsoļu arhīvu", async () => {
    const blocks = mergeSourceBlocksWithDefaults({});
    const r1 = await importVendorArchiveGroups({
      sessionId: SID,
      source: "autodna",
      via: "pdf",
      groups: [{ date: "12.11.2024", expected: 2, photos: [ex(await photo(5)), ex(await photo(6))] }],
      sourceBlocks: blocks,
    });
    const gid = r1.tirgus.photoGroups[0]!.id;
    const moved = await moveVendorArchiveGroup({ sessionId: SID, groupId: gid, to: "cc_vin", sourceBlocks: { ...blocks, tirgus: r1.tirgus } });
    if (!moved.ok) throw new Error(moved.error);
    expect(moved.tirgus.photoGroups).toHaveLength(0);
    const ccG = moved.cc_vin.photoGroups[0]!;
    expect(ccG.id).toMatch(/^ih_phg_/);
    expect(ccG.photos.every((p) => /^ih_ph_/.test(p.id) && ih.has(p.id))).toBe(true);
    expect(ccG.archive).toMatchObject({ source: "autodna", date: "12.11.2024", expected: 2 });
    expect(Object.keys(ccG.archive!.hashes!)).toEqual(ccG.photos.map((p) => p.id));

    const afterMove = mergeSourceBlocksWithDefaults({ ...blocks, tirgus: moved.tirgus, cc_vin: moved.cc_vin });
    expect(afterMove.cc_vin.photoGroups[0]!.archive?.source).toBe("autodna");
    const reimport = await importVendorArchiveGroups({
      sessionId: SID,
      source: "autodna",
      via: "pdf",
      groups: [{ date: "12.11.2024", photos: [ex(await photo(5))] }],
      sourceBlocks: afterMove,
    });
    expect(reimport.added).toBe(0);

    const back = await moveVendorArchiveGroup({ sessionId: SID, groupId: ccG.id, to: "tirgus", sourceBlocks: afterMove });
    if (!back.ok) throw new Error(back.error);
    expect(back.cc_vin.photoGroups).toHaveLength(0);
    expect(back.tirgus.photoGroups[0]).toMatchObject({ title: "12.11.2024", archive: { source: "autodna" } });
    expect(back.tirgus.photoGroups[0]!.photos.every((p) => sbp.has(p.id))).toBe(true);
  });

  it("nezināma grupa -> kļūda", async () => {
    const res = await moveVendorArchiveGroup({ sessionId: SID, groupId: "sbp_phg_x", to: "cc_vin", sourceBlocks: mergeSourceBlocksWithDefaults({}) });
    expect(res).toEqual({ ok: false, error: "group_not_found" });
  });
});

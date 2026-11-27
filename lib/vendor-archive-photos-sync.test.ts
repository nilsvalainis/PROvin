import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const sbp = new Map<string, Buffer>();
const la = new Map<string, Buffer>();
let seq = 0;

vi.mock("@/lib/admin-source-block-photo-store", () => ({
  readSourceBlockPhotoJpeg: async (_s: string, id: string) => sbp.get(id) ?? null,
}));
vi.mock("@/lib/admin-cc-vin-photo-store", () => ({
  readCcVinPhotoJpeg: async () => null,
}));
vi.mock("@/lib/admin-listing-analysis-photo-store", () => ({
  makeListingAnalysisPhotoId: () => `la_ph_${String(++seq).padStart(24, "0")}`,
  writeListingAnalysisPhotoJpeg: async (_s: string, id: string, b: Buffer) => void la.set(id, b),
}));
vi.mock("@/lib/order-dropbox", () => ({
  ensureOrderDropboxFolder: async () => ({ state: "ok", path: "/PROVIN/Pasutijumi/2026-11-25 Audi A6" }),
  currentOrderDropboxFolderPath: async (_c: unknown, rec: { path?: string }) => rec.path ?? "",
}));

import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { mirrorVendorArchivePhotosToDropbox, pickVendorArchiveCover } from "@/lib/vendor-archive-photos-sync";

const SID = "cs_test_archive_sync_1";
const jpg = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 90, g: 90, b: 90 } } }).jpeg().toBuffer();

function blocks(cover?: { id: string } | null) {
  const b = mergeSourceBlocksWithDefaults({});
  b.tirgus = {
    ...b.tirgus,
    photoGroups: [
      {
        id: "sbp_phg_000000000000000000000001",
        title: "12.11.2024",
        photos: [{ id: "sbp_ph_1" }, { id: "sbp_ph_2" }],
        archive: { source: "autodna", date: "12.11.2024", via: "relay" },
      },
    ],
  } as typeof b.tirgus;
  if (cover !== undefined) b.listing_analysis = { ...b.listing_analysis, coverPhoto: cover };
  return b;
}

beforeEach(async () => {
  sbp.clear();
  la.clear();
  sbp.set("sbp_ph_1", await jpg(300, 400)); // vertikāla
  sbp.set("sbp_ph_2", await jpg(800, 600));
});

describe("pickVendorArchiveCover", () => {
  it("tukšā laukā ieliek horizontālo ārpuses foto kopiju", async () => {
    const next = await pickVendorArchiveCover({ sessionId: SID, source: "autodna", sourceBlocks: blocks() });
    expect(next?.coverPhoto?.id).toMatch(/^la_ph_/);
    expect(la.get(next!.coverPhoto!.id)).toBe(sbp.get("sbp_ph_2"));
  });

  it("Nila titulbildi un noņemto (null) neaiztiek", async () => {
    expect(await pickVendorArchiveCover({ sessionId: SID, source: "autodna", sourceBlocks: blocks({ id: "la_ph_000000000000000000000abc" }) })).toBeNull();
    expect(await pickVendorArchiveCover({ sessionId: SID, source: "autodna", sourceBlocks: blocks(null) })).toBeNull();
    expect(la.size).toBe(0);
  });
});

describe("mirrorVendorArchivePhotosToDropbox", () => {
  it("augšupielādē trūkstošos, esošos izlaiž", async () => {
    const uploads: { path: string; mode: string }[] = [];
    const client = {
      listAll: vi.fn(async () => ({ entries: [{ tag: "file", name: "01.jpg" }], cursor: "" })),
      upload: vi.fn(async (path: string, _b: Uint8Array, mode: string) => {
        uploads.push({ path, mode });
        return { pathDisplay: path };
      }),
    };
    const res = await mirrorVendorArchivePhotosToDropbox({
      sessionId: SID,
      source: "autodna",
      sourceBlocks: blocks(),
      client: client as never,
    });
    expect(res.uploaded).toBe(1);
    expect(uploads).toEqual([{ path: "/PROVIN/Pasutijumi/2026-11-25 Audi A6/Foto - AutoDNA arhīvs 12.11.2024/02.jpg", mode: "add" }]);
  });

  it("bez Dropbox - nekas nenotiek", async () => {
    expect(await mirrorVendorArchivePhotosToDropbox({ sessionId: SID, source: "autodna", sourceBlocks: blocks(), client: null })).toEqual({
      uploaded: 0,
      failed: 0,
      folder: null,
    });
  });
});

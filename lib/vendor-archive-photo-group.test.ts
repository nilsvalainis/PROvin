import { describe, expect, it } from "vitest";

import { normalizeCcVinPhotoGroups } from "@/lib/cc-vin-photo-types";
import { resolvePdfTopPhoto } from "@/lib/pdf-report-top";
import { normalizeListingHistoryPhotoGroups } from "@/lib/source-block-photo-types";
import {
  dhashDistance,
  isDuplicateDhash,
  mergeVendorArchivePhotoGroups,
  parseVendorArchiveGroupMeta,
  setVendorArchiveShowSource,
  vendorArchiveAdminLabel,
  vendorArchiveClientTitle,
  type VendorArchiveGroupMeta,
} from "@/lib/vendor-archive-photo-group";

const ph = (n: number) => `sbp_ph_${String(n).padStart(24, "0")}`;
const grp = (n: number) => `sbp_phg_${String(n).padStart(24, "0")}`;

describe("vendor-archive-photo-group", () => {
  it("klientam tikai datums, avots - tikai ieslēdzot", () => {
    const meta = { source: "carvertical" as const, date: "07.2020" };
    expect(vendorArchiveClientTitle(meta, false)).toBe("07.2020");
    expect(vendorArchiveClientTitle(meta, true)).toBe("CarVertical · 07.2020");
    expect(vendorArchiveAdminLabel({ ...meta, via: "pdf" })).toBe("CarVertical · 07.2020 · no PDF");
  });

  it("«Rādīt avotu klientam» pārslēdz automātisko virsrakstu, ar roku rakstītu neaiztiek", () => {
    const archive: VendorArchiveGroupMeta = { source: "autodna", date: "07.2020", via: "pdf" };
    const g: { id: string; title: string; photos: { id: string }[]; archive?: VendorArchiveGroupMeta } = { id: grp(1), title: "07.2020", photos: [], archive };
    const on = setVendorArchiveShowSource(g, true);
    expect(on.title).toBe("AutoDNA · 07.2020");
    expect(on.archive?.showSource).toBe(true);
    const off = setVendorArchiveShowSource(on, false);
    expect(off.title).toBe("07.2020");
    expect(off.archive?.showSource).toBeUndefined();
    const custom = setVendorArchiveShowSource({ ...g, title: "Sludinājums Vācijā" }, true);
    expect(custom.title).toBe("Sludinājums Vācijā");
    expect(custom.archive?.showSource).toBe(true);
  });

  it("meta parse: nederīgs avots -> nav; hash tikai grupas bildēm", () => {
    expect(parseVendorArchiveGroupMeta({ source: "carfax", date: "x" })).toBeUndefined();
    const m = parseVendorArchiveGroupMeta(
      { source: "carvertical", date: "07.2020.", via: "relay", hashes: { [ph(1)]: "00ff00ff00ff00ff", [ph(2)]: "nope", [ph(9)]: "0000000000000001" } },
      [ph(1), ph(2)],
    );
    expect(m).toEqual({ source: "carvertical", date: "07.2020", via: "relay", hashes: { [ph(1)]: "00ff00ff00ff00ff" } });
  });

  it("dHash attālums", () => {
    expect(dhashDistance("0000000000000000", "0000000000000003")).toBe(2);
    expect(dhashDistance("bad", "0000000000000000")).toBe(64);
    expect(isDuplicateDhash("00000000000000ff", ["ffffffffffffffff", "000000000000003f"])).toBe(true);
    expect(isDuplicateDhash("00000000000000ff", ["ffffffffffffffff"])).toBe(false);
  });

  it("sapludina pēc avota + datuma, ar roku grupas neaiztiek, griests", () => {
    let n = 100;
    const manual: { id: string; title: string; photos: { id: string }[]; archive?: VendorArchiveGroupMeta } = { id: grp(1), title: "Mana grupa", photos: [{ id: ph(1) }] };
    const res = mergeVendorArchivePhotoGroups(
      [manual],
      [
        { source: "carvertical", date: "07.2020", via: "pdf", photos: [{ id: ph(2), hash: "0000000000000001" }] },
        { source: "carvertical", date: "07.2020.", via: "pdf", photos: [{ id: ph(3), hash: "0000000000000002" }] },
        { source: "autodna", date: "12.11.2024", via: "pdf", expected: 35, photos: [{ id: ph(4), hash: "0000000000000004" }, { id: ph(5), hash: "0000000000000005" }] },
      ],
      { max: 4, makeGroupId: () => grp(n++) },
    );
    expect(res.added).toBe(3);
    expect(res.overLimit).toBe(1);
    expect(res.groups.map((g) => [g.title, g.photos.length])).toEqual([
      ["Mana grupa", 1],
      ["07.2020", 2],
      ["12.11.2024", 1],
    ]);
    expect(res.groups[0]).toEqual(manual);
    expect(res.groups[2]!.archive).toMatchObject({ source: "autodna", expected: 35, hashes: { [ph(4)]: "0000000000000004" } });
  });

  it("normalizatori saglabā arhīva meta (tirgus un izsoļu arhīvs), tukšu arhīva grupu izmet", () => {
    const archive = { source: "carvertical", date: "07.2020", via: "pdf", hashes: { [ph(1)]: "0000000000000001" } };
    const t = normalizeListingHistoryPhotoGroups([
      { id: grp(1), title: "07.2020", photos: [{ id: ph(1) }], archive },
      { id: grp(2), title: "07.2020", photos: [], archive },
      { id: grp(3), title: "Ar roku", photos: [] },
    ]);
    expect(t.map((g) => g.id)).toEqual([grp(1), grp(3)]);
    expect(t[0]!.archive).toEqual(archive);
    const ihPh = `ih_ph_${"1".padStart(24, "0")}`;
    const cc = normalizeCcVinPhotoGroups([
      { id: `ih_phg_${"1".padStart(24, "0")}`, title: "07.2020", photos: [{ id: ihPh }], archive: { ...archive, hashes: { [ihPh]: "0000000000000001" } } },
    ]);
    expect(cc[0]!.archive).toMatchObject({ source: "carvertical", date: "07.2020", hashes: { [ihPh]: "0000000000000001" } });
  });

  it("1. lapas foto no arhīva grupas: paraksts bez avota, ar datumu", () => {
    const src = "data:image/jpeg;base64,AAAA";
    const urls = new Map([[ph(1), src]]);
    const base = { source: "carvertical" as const, date: "07.2020", via: "pdf" as const };
    const plain = resolvePdfTopPhoto({
      tirgusForm: { photoGroups: [{ title: "07.2020", photos: [{ id: ph(1) }], archive: base }] },
      sourceBlockPhotoDataUrls: urls,
      listingUrl: "https://www.ss.com/msg/x.html",
    });
    expect(plain).toMatchObject({ kind: "listingHistory", where: "", date: "07.2020" });
    const shown = resolvePdfTopPhoto({
      tirgusForm: { photoGroups: [{ title: "CarVertical · 07.2020", photos: [{ id: ph(1) }], archive: base }] },
      sourceBlockPhotoDataUrls: urls,
    });
    expect(shown).toMatchObject({ where: "CarVertical · 07.2020", date: "" });
  });
});

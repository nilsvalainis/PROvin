import { describe, expect, it } from "vitest";

import {
  collectOrderPhotoDropboxItems,
  emptyOrderPhotoDropboxRecord,
  ORDER_PHOTO_DROPBOX_MAX_ATTEMPTS,
  orderPhotoDropboxFailure,
  orderPhotoDropboxFileName,
  orderPhotoDropboxFolder,
  orderPhotoDropboxNextAt,
  orderPhotoDropboxStatus,
  parseOrderPhotoDropboxRecord,
  pendingOrderPhotoDropboxItems,
} from "@/lib/order-photo-dropbox-plan";

const id = (p: string, n: number) => `${p}_ph_${String(n).padStart(24, "0")}`;
const IH1 = id("ih", 1);
const IH2 = id("ih", 2);
const IH3 = id("ih", 3);
const SB1 = id("sbp", 1);
const SB2 = id("sbp", 2);
const LA1 = id("la", 1);
const INC1 = id("inc", 1);
const ASV1 = id("asv", 1);

describe("pasūtījuma bilžu mapes", () => {
  it("mapes nosaukumi: izsolēm grupas virsraksts, pārējiem avots - virsraksts", () => {
    expect(orderPhotoDropboxFolder("cc_vin", "Autobid 12.10.2026")).toBe("Foto - Autobid 12.10.2026");
    expect(orderPhotoDropboxFolder("cc_vin", "")).toBe("Foto - Izsoles");
    expect(orderPhotoDropboxFolder("asv", "Copart 2021")).toBe("Foto - ASV - Copart 2021");
    expect(orderPhotoDropboxFolder("incident", "")).toBe("Foto - Negadījumi");
    expect(orderPhotoDropboxFolder("csdd", "a/b:c")).toBe("Foto - CSDD - a b c");
    expect(orderPhotoDropboxFileName({ baseName: "03" }, "webp")).toBe("03.webp");
  });

  it("savāc visas galerijas, izlaiž arhīva grupas un dublētus id", () => {
    const items = collectOrderPhotoDropboxItems({
      sourceBlocks: {
        cc_vin: {
          photoGroups: [
            { title: "Openlane 02.11.2026", photos: [{ id: IH1, sourceUrl: "https://img.example/1.jpg" }, { id: IH2 }] },
            { title: "AutoDNA", archive: { source: "autodna", date: "" }, photos: [{ id: IH3 }] },
          ],
          photos: [{ id: IH1 }, { id: IH2 }, { id: IH3 }],
        },
        tirgus: { photos: [{ id: SB1 }] },
        citi_avoti: { sections: [{ label: "Car-Pass", photoGroups: [{ title: "", photos: [{ id: SB2 }] }] }] },
        listing_analysis: { photoGroups: [], photos: [], coverPhoto: { id: LA1 } },
        asv: { photoGroups: [{ title: "", photos: [{ id: ASV1 }, { id: "bad" }] }] },
      },
      incidentPhotoGroups: [{ title: "2021", photos: [{ id: INC1 }, { id: IH1 }] }],
    });
    expect(items).toEqual([
      { photoId: IH1, folder: "Foto - Openlane 02.11.2026", baseName: "01", sourceUrl: "https://img.example/1.jpg" },
      { photoId: IH2, folder: "Foto - Openlane 02.11.2026", baseName: "02" },
      { photoId: SB1, folder: "Foto - Sludinājumu vēsture", baseName: "01" },
      { photoId: SB2, folder: "Foto - Citi avoti - Car-Pass", baseName: "01" },
      { photoId: LA1, folder: "Foto - Sludinājums - Titulbilde", baseName: "01" },
      { photoId: ASV1, folder: "Foto - ASV", baseName: "01" },
      { photoId: INC1, folder: "Foto - Negadījumi - 2021", baseName: "01" },
    ]);
  });
});

describe("statuss un atkārtojumi", () => {
  const items = [
    { photoId: IH1, folder: "Foto - A", baseName: "01" },
    { photoId: IH2, folder: "Foto - A", baseName: "02" },
    { photoId: IH3, folder: "Foto - A", baseName: "03" },
  ];
  const now = Date.parse("2026-11-27T10:00:00Z");

  it("N/M, gaidošās un kļūdas ar atkārtojumu", () => {
    const rec = emptyOrderPhotoDropboxRecord("cs_test_1", now);
    rec.items[IH1] = { s: "ok", f: "Foto - A", n: 1, at: "" };
    rec.items[IH2] = orderPhotoDropboxFailure(undefined, "Foto - A", "dropbox_500", now);
    expect(orderPhotoDropboxStatus(items, rec)).toMatchObject({ total: 3, saved: 1, failed: 1, waiting: 1 });
    // IH2 gaida 5 min; IH3 vēl nav mēģināts.
    expect(pendingOrderPhotoDropboxItems(items, rec, now).map((i) => i.photoId)).toEqual([IH3]);
    expect(pendingOrderPhotoDropboxItems(items, rec, now + 6 * 60_000).map((i) => i.photoId)).toEqual([IH2, IH3]);
    expect(orderPhotoDropboxNextAt(items, rec, now)).toBe(new Date(now + 5 * 60_000).toISOString());
  });

  it("pēc max mēģinājumiem automātika apstājas, poga (force) mēģina vēlreiz", () => {
    const rec = emptyOrderPhotoDropboxRecord("cs_test_1", now);
    let st = undefined as ReturnType<typeof orderPhotoDropboxFailure> | undefined;
    for (let i = 0; i < ORDER_PHOTO_DROPBOX_MAX_ATTEMPTS; i += 1) st = orderPhotoDropboxFailure(st, "Foto - A", "x", now);
    expect(st!.next).toBeUndefined();
    rec.items[IH1] = st!;
    rec.items[IH2] = { s: "ok", f: "Foto - A", n: 1, at: "" };
    rec.items[IH3] = { s: "ok", f: "Foto - A", n: 1, at: "" };
    expect(pendingOrderPhotoDropboxItems(items, rec, now + 1e9)).toEqual([]);
    expect(orderPhotoDropboxNextAt(items, rec, now)).toBeNull();
    expect(pendingOrderPhotoDropboxItems(items, rec, now, true).map((i) => i.photoId)).toEqual([IH1]);
  });

  it("ieraksta parsēšana atmet nederīgo", () => {
    const rec = parseOrderPhotoDropboxRecord(
      { items: { [IH1]: { s: "ok", f: "Foto - A", n: 1, at: "x" }, bad: { s: "ok" }, [IH2]: { s: "weird" } } },
      "cs_test_1",
    );
    expect(Object.keys(rec.items)).toEqual([IH1]);
  });
});

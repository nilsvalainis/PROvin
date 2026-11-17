import { describe, expect, it } from "vitest";
import { offerImageFullSrc, offerImageGridSrc } from "@/lib/iriss-offer-image-sorter";
import {
  isSafeDropboxFileId,
  orderStockPhotoGroups,
  orderStockPhotos,
  parseOfferSourceRef,
  pendingDropboxPhotoCount,
  stockPhotoAttachment,
} from "@/lib/iriss-stock-photos";

const f = (n: number, name: string, serverModified = "2026-10-01T00:00:00Z") => ({ id: `id:file${n}`, name, serverModified });

describe("stock photos", () => {
  it("orders like PRO: natural name order, first is cover", () => {
    const out = orderStockPhotos([f(1, "IMG_10.jpg"), f(2, "IMG_2.jpg"), f(3, "IMG_1.HEIC")]);
    expect(out.map((p) => p.name)).toEqual(["IMG_1.HEIC", "IMG_2.jpg", "IMG_10.jpg"]);
  });

  it("puts the Autoparks main photo first", () => {
    const out = orderStockPhotos([f(1, "a.jpg"), f(2, "b.jpg"), f(3, "c.jpg")], { mainPhotoId: "id:file3" });
    expect(out.map((p) => p.dropboxId)).toEqual(["id:file3", "id:file1", "id:file2"]);
  });

  it("takes only the first 60", () => {
    const many = Array.from({ length: 75 }, (_, i) => f(i, `IMG_${i + 1}.jpg`));
    const out = orderStockPhotos(many);
    expect(out).toHaveLength(60);
    expect(out.at(-1)?.name).toBe("IMG_60.jpg");
  });

  it("J36: orders groups separately so izsole/canon never interleave by name", () => {
    const izsole = [f(1, "10.jpg"), f(2, "2.jpg"), f(3, "1.jpg")];
    const canon = [f(4, "2.jpg"), f(5, "1.jpg")];
    const out = orderStockPhotoGroups([izsole, canon]);
    expect(out.map((p) => p.dropboxId)).toEqual(["id:file3", "id:file2", "id:file1", "id:file5", "id:file4"]);
  });

  it("J36: group order still honors the Autoparks main photo first", () => {
    const izsole = [f(1, "1.jpg"), f(2, "2.jpg")];
    const canon = [f(3, "1.jpg")];
    const out = orderStockPhotoGroups([izsole, canon], { mainPhotoId: "id:file3" });
    expect(out.map((p) => p.dropboxId)).toEqual(["id:file3", "id:file1", "id:file2"]);
  });

  it("parses only autoparks/logistics refs and Dropbox ids", () => {
    expect(parseOfferSourceRef("autoparks:car_123")).toEqual({ kind: "autoparks", id: "car_123" });
    expect(parseOfferSourceRef("logistics:abc-1")).toEqual({ kind: "logistics", id: "abc-1" });
    expect(parseOfferSourceRef("dropbox:/STOCK")).toBeNull();
    expect(parseOfferSourceRef("autoparks:../x")).toBeNull();
    expect(isSafeDropboxFileId("id:a4ayc_80_OEAAAAAAAAAXw")).toBe(true);
    expect(isSafeDropboxFileId("/STOCK/a.jpg")).toBe(false);
  });

  it("makes a not-yet-copied attachment shown through the admin proxy", () => {
    const att = stockPhotoAttachment({ kind: "autoparks", id: "car1" }, { dropboxId: "id:abcDEF123", name: "IMG_1.HEIC" });
    expect(att).toMatchObject({ dropboxId: "id:abcDEF123", name: "IMG_1.jpg", mimeType: "image/jpeg", dataUrl: "" });
    expect(offerImageGridSrc(att)).toBe("/api/admin/iriss-offer-seed/photo?from=autoparks%3Acar1&id=id%3AabcDEF123&s=thumb");
    expect(offerImageFullSrc(att)).toBe("/api/admin/iriss-offer-seed/photo?from=autoparks%3Acar1&id=id%3AabcDEF123&s=full");
    expect(pendingDropboxPhotoCount([att, { dropboxId: "id:x", blobPath: "a", dataUrl: "" }])).toBe(1);
  });
});
